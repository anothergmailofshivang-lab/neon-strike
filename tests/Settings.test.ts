import { describe, expect, it } from 'vitest';
import { ACTION_IDS, DEFAULT_KEY_BINDINGS, SettingsService, defaultGameSettings, normalizeSettings } from '../src/settings/SettingsService';

const constraints = { sensitivityMinimum: 0.00055, sensitivityMaximum: 0.0088, fieldOfViewMinimum: 60, fieldOfViewMaximum: 100 };
const defaults = defaultGameSettings();
function storage() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
describe('authoritative settings and migrations', () => {
  it('loads explicit defaults and normalizes every damaged field independently', () => {
    const value = normalizeSettings({ mouseSensitivity: NaN, fieldOfView: Infinity, masterVolume: -4, effectsVolume: 9, invertY: true, renderScale: 0, sprintMode: 'invalid', crosshairColor: 'url(bad)', hudScale: 100 }, defaults, constraints);
    expect(value.mouseSensitivity).toBe(defaults.mouseSensitivity); expect(value.fieldOfView).toBe(defaults.fieldOfView);
    expect(value.masterVolume).toBe(0); expect(value.effectsVolume).toBe(1); expect(value.invertY).toBe(true);
    expect(value.renderScale).toBe(0.5); expect(value.sprintMode).toBe('hold'); expect(value.hudScale).toBe(1.25);
    expect(value.crosshairColor).toBe(defaults.crosshairColor); expect(value.keyBindings).toEqual(DEFAULT_KEY_BINDINGS);
  });
  it('migrates legacy camera settings and recognizes returning players', () => {
    const store = storage(); store.setItem('neon-strike.player-settings', JSON.stringify({ mouseSensitivity: 0.004, headBobEnabled: false }));
    const service = new SettingsService(store); const value = service.load(defaults, constraints);
    expect(service.loadStatus).toBe('migrated'); expect(value.onboardingStatus).toBe('returning');
    expect(value.mouseSensitivity).toBe(0.004); expect(value.headBobEnabled).toBe(false);
    expect(value.keyBindings.interact).toBe('KeyE');
  });
  it('distinguishes new, existing profile, skipped, corrupt and unavailable saves', () => {
    const store = storage(); const fresh = new SettingsService(store); expect(fresh.load(defaults, constraints).onboardingStatus).toBe('new');
    fresh.update({ onboardingStatus: 'skipped', onboardingCompleted: true });
    expect(new SettingsService(store).load(defaults, constraints).onboardingStatus).toBe('skipped');
    store.data.delete('neon-strike.player-settings'); store.setItem('neon-strike.player-profile', '{"xp":100}');
    expect(new SettingsService(store).load(defaults, constraints).onboardingStatus).toBe('returning');
    store.setItem('neon-strike.player-settings', '{bad'); const recovery = new SettingsService(store);
    expect(recovery.load(defaults, constraints).onboardingStatus).toBe('recovery'); expect(recovery.loadStatus).toBe('recovery');
    const unavailable = new SettingsService(null); unavailable.load(defaults, constraints); expect(unavailable.loadStatus).toBe('unavailable');
  });
  it('rejects conflicts/reserved bindings and repairs corrupt bindings without duplicates', () => {
    const service = new SettingsService(storage()); service.load(defaults, constraints);
    expect(service.rebind('interact', 'KeyG')).toContain('already assigned'); expect(service.rebind('interact', 'F5')).toContain('reserved');
    expect(service.rebind('interact', 'KeyF')).toBeNull(); expect(service.current.keyBindings.interact).toBe('KeyF');
    const repaired = normalizeSettings({ keyBindings: { ...DEFAULT_KEY_BINDINGS, moveForward: 'KeyE', moveBackward: 'F5', interact: 'KeyE', pause: 'KeyL' } }, defaults, constraints);
    expect(new Set(Object.values(repaired.keyBindings)).size).toBe(ACTION_IDS.length); expect(repaired.keyBindings.pause).toBe('Escape');
    expect(repaired.keyBindings.moveForward).toBe('KeyE');
  });
  it('persists changes/reloads and scoped resets preserve progress and tutorial flags', () => {
    const store = storage(); store.setItem('neon-strike.player-profile', 'career data'); store.setItem('neon-strike.player-preferences', 'loadout data');
    const service = new SettingsService(store); service.load(defaults, constraints);
    service.update({ mouseSensitivity: 0.006, tutorialCompleted: true, onboardingStatus: 'completed', invertY: true }); service.rebind('interact', 'KeyF');
    const next = new SettingsService(store); next.load(defaults, constraints); expect(next.current.invertY).toBe(true);
    next.resetControls(); expect(next.current.mouseSensitivity).toBe(0.006); expect(next.current.keyBindings).toEqual(DEFAULT_KEY_BINDINGS);
    next.resetSettings(); expect(next.current.mouseSensitivity).toBe(defaults.mouseSensitivity); expect(next.current.tutorialCompleted).toBe(true);
    expect(store.getItem('neon-strike.player-profile')).toBe('career data'); expect(store.getItem('neon-strike.player-preferences')).toBe('loadout data');
  });
  it('keeps live changes on write failure and retries only explicitly', () => {
    let writes = 0; const service = new SettingsService({ getItem: () => null, setItem: () => { writes++; throw new Error('quota'); } });
    service.load(defaults, constraints); let observed = 0; const off = service.subscribe(() => observed++);
    expect(service.update({ effectsVolume: 0.2 })).toBe(false); service.update({ effectsVolume: 0.4 });
    expect(service.current.effectsVolume).toBe(0.4); expect(writes).toBe(1); expect(observed).toBe(2);
    off(); service.retrySave(); expect(writes).toBe(2); expect(observed).toBe(2);
  });
});
