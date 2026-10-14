import type { StorageLike } from '../persistence/SaveManager';

export const SETTINGS_SCHEMA_VERSION = 2;
export const SETTINGS_STORAGE_KEY = 'neon-strike.player-settings';

export type SprintMode = 'hold' | 'toggle';
export type GraphicsQuality = 'low' | 'medium' | 'high' | 'custom';
export type ParticleQuality = 'low' | 'high';
export type CrosshairStyle = 'cross' | 'dot' | 'circle';

export const ACTION_IDS = [
  'moveForward', 'moveBackward', 'moveLeft', 'moveRight', 'jump', 'sprint',
  'reload', 'primaryWeapon', 'secondaryWeapon', 'nextWeapon', 'tactical',
  'utility', 'interact', 'pause', 'scoreboard',
] as const;
export type ActionId = typeof ACTION_IDS[number];
export type KeyBindings = Record<ActionId, string>;

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  sprint: 'ShiftLeft',
  reload: 'KeyR',
  primaryWeapon: 'Digit1',
  secondaryWeapon: 'Digit2',
  nextWeapon: 'KeyQ',
  tactical: 'KeyG',
  utility: 'KeyH',
  interact: 'KeyE',
  pause: 'Escape',
  scoreboard: 'Tab',
};

export interface GameSettings {
  schemaVersion: number;
  mouseSensitivity: number;
  invertY: boolean;
  fieldOfView: number;
  sprintMode: SprintMode;
  headBobEnabled: boolean;
  cameraEffectsEnabled: boolean;
  masterVolume: number;
  effectsVolume: number;
  defaultDifficulty: 'easy' | 'normal' | 'hard' | 'expert';
  graphicsQuality: GraphicsQuality;
  renderScale: number;
  particleQuality: ParticleQuality;
  motionReduction: boolean;
  screenShake: boolean;
  reducedFlashes: boolean;
  crosshairStyle: CrosshairStyle;
  crosshairScale: number;
  crosshairColor: string;
  crosshairOutline: boolean;
  hudScale: number;
  showHints: boolean;
  onboardingCompleted: boolean;
  tutorialCompleted: boolean;
  onboardingStatus: 'new' | 'completed' | 'skipped' | 'returning' | 'recovery';
  keyBindings: KeyBindings;
}

export interface SettingsConstraints {
  sensitivityMinimum: number;
  sensitivityMaximum: number;
  fieldOfViewMinimum: number;
  fieldOfViewMaximum: number;
}

export function defaultGameSettings(
  mouseSensitivity = 0.0022,
  fieldOfView = 70,
  headBobEnabled = true,
  cameraEffectsEnabled = true,
): GameSettings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    mouseSensitivity,
    invertY: false,
    fieldOfView,
    sprintMode: 'hold',
    headBobEnabled,
    cameraEffectsEnabled,
    masterVolume: 1,
    effectsVolume: 1,
    defaultDifficulty: 'normal',
    graphicsQuality: 'high',
    renderScale: 1,
    particleQuality: 'high',
    motionReduction: false,
    screenShake: true,
    reducedFlashes: false,
    crosshairStyle: 'cross',
    crosshairScale: 1,
    crosshairColor: '#e0fdff',
    crosshairOutline: true,
    hudScale: 1,
    showHints: true,
    onboardingCompleted: false,
    tutorialCompleted: false,
    onboardingStatus: 'new',
    keyBindings: { ...DEFAULT_KEY_BINDINGS },
  };
}

export function normalizeSettings(
  raw: unknown,
  defaults: GameSettings,
  constraints: SettingsConstraints,
): GameSettings {
  const candidate = raw && typeof raw === 'object' ? raw as Partial<GameSettings> : {};
  const rawBindings = candidate.keyBindings && typeof candidate.keyBindings === 'object'
    ? candidate.keyBindings as Partial<KeyBindings>
    : {};
  const bindings = { ...defaults.keyBindings };
  const used = new Set<string>(['Escape']);
  for (const action of ACTION_IDS) {
    if (action === 'pause') continue;
    if (typeof rawBindings[action] === 'string' && isSafeBinding(rawBindings[action]!) && !used.has(rawBindings[action]!)) {
      bindings[action] = rawBindings[action]!;
      used.add(bindings[action]);
    } else {
      bindings[action] = '';
    }
  }
  // Fill only damaged entries, without invalidating legitimate custom keys.
  for (const action of ACTION_IDS) if (!bindings[action]) {
    bindings[action] = [DEFAULT_KEY_BINDINGS[action], ...Object.values(DEFAULT_KEY_BINDINGS), ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((key) => `Key${key}`)]
      .find((code) => code !== 'Escape' && !used.has(code))!;
    used.add(bindings[action]);
  }
  bindings.pause = 'Escape';
  const sensitivityMinimum = finiteOr(constraints.sensitivityMinimum, defaults.mouseSensitivity * 0.25);
  const sensitivityMaximum = Math.max(sensitivityMinimum, finiteOr(constraints.sensitivityMaximum, defaults.mouseSensitivity * 4));
  const fieldOfViewMinimum = finiteOr(constraints.fieldOfViewMinimum, 60);
  const fieldOfViewMaximum = Math.max(fieldOfViewMinimum, finiteOr(constraints.fieldOfViewMaximum, 100));
  const graphicsQuality = enumOr(candidate.graphicsQuality, ['low', 'medium', 'high', 'custom'], defaults.graphicsQuality);
  const presetScale = graphicsQuality === 'low' ? 0.5 : graphicsQuality === 'medium' ? 0.75 : 1;
  const presetParticles = graphicsQuality === 'low' || graphicsQuality === 'medium' ? 'low' : 'high';
  return {
    ...defaults,
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    mouseSensitivity: clamp(candidate.mouseSensitivity, sensitivityMinimum, sensitivityMaximum, defaults.mouseSensitivity),
    invertY: booleanOr(candidate.invertY, defaults.invertY),
    fieldOfView: clamp(candidate.fieldOfView, fieldOfViewMinimum, fieldOfViewMaximum, defaults.fieldOfView),
    sprintMode: enumOr(candidate.sprintMode, ['hold', 'toggle'], defaults.sprintMode),
    headBobEnabled: booleanOr(candidate.headBobEnabled, defaults.headBobEnabled),
    cameraEffectsEnabled: booleanOr(candidate.cameraEffectsEnabled, defaults.cameraEffectsEnabled),
    masterVolume: clamp(candidate.masterVolume, 0, 1, defaults.masterVolume),
    effectsVolume: clamp(candidate.effectsVolume, 0, 1, defaults.effectsVolume),
    defaultDifficulty: enumOr(candidate.defaultDifficulty, ['easy', 'normal', 'hard', 'expert'], defaults.defaultDifficulty),
    graphicsQuality,
    renderScale: clamp(candidate.renderScale, 0.5, 1, graphicsQuality === 'custom' ? defaults.renderScale : presetScale),
    particleQuality: enumOr(candidate.particleQuality, ['low', 'high'], graphicsQuality === 'custom' ? defaults.particleQuality : presetParticles),
    motionReduction: booleanOr(candidate.motionReduction, defaults.motionReduction),
    screenShake: booleanOr(candidate.screenShake, defaults.screenShake),
    reducedFlashes: booleanOr(candidate.reducedFlashes, defaults.reducedFlashes),
    crosshairStyle: enumOr(candidate.crosshairStyle, ['cross', 'dot', 'circle'], defaults.crosshairStyle),
    crosshairScale: clamp(candidate.crosshairScale, 0.6, 1.8, defaults.crosshairScale),
    crosshairColor: typeof candidate.crosshairColor === 'string' && /^#[0-9a-f]{6}$/i.test(candidate.crosshairColor)
      ? candidate.crosshairColor : defaults.crosshairColor,
    crosshairOutline: booleanOr(candidate.crosshairOutline, defaults.crosshairOutline),
    hudScale: clamp(candidate.hudScale, 0.85, 1.25, defaults.hudScale),
    showHints: booleanOr(candidate.showHints, defaults.showHints),
    onboardingCompleted: booleanOr(candidate.onboardingCompleted, defaults.onboardingCompleted),
    tutorialCompleted: booleanOr(candidate.tutorialCompleted, defaults.tutorialCompleted),
    onboardingStatus: enumOr(candidate.onboardingStatus, ['new', 'completed', 'skipped', 'returning', 'recovery'], candidate.onboardingCompleted ? 'completed' : defaults.onboardingStatus),
    keyBindings: bindings,
  };
}

export class SettingsService {
  private readonly storage: StorageLike | null;
  private value = defaultGameSettings();
  private defaults = defaultGameSettings();
  private constraints: SettingsConstraints = { sensitivityMinimum: 0.00055, sensitivityMaximum: 0.0088, fieldOfViewMinimum: 60, fieldOfViewMaximum: 100 };
  private readonly listeners = new Set<(settings: GameSettings) => void>();
  private writeFailed = false;
  public persisted = true;
  public loadStatus: 'new' | 'loaded' | 'migrated' | 'recovery' | 'unavailable' = 'new';

  public constructor(
    storage: StorageLike | null = browserStorage(),
    private readonly key = SETTINGS_STORAGE_KEY,
  ) {
    this.storage = storage;
  }

  public load(defaults: GameSettings, constraints: SettingsConstraints): GameSettings {
    this.defaults = structuredClone(defaults);
    this.constraints = { ...constraints };
    let raw: unknown = null;
    let returning = false;
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      const encoded = this.storage.getItem(this.key);
      returning = Boolean(encoded || this.storage.getItem('neon-strike.player-profile') || this.storage.getItem('neon-strike.player-preferences'));
      if (encoded) {
        try {
          raw = JSON.parse(encoded);
          if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid settings');
          this.loadStatus = (raw as GameSettings).schemaVersion === SETTINGS_SCHEMA_VERSION ? 'loaded' : 'migrated';
        } catch { this.loadStatus = 'recovery'; }
      } else this.loadStatus = returning ? 'migrated' : 'new';
    } catch {
      this.loadStatus = 'unavailable'; this.persisted = false;
    }
    const policy = this.loadStatus === 'recovery' || this.loadStatus === 'unavailable' ? 'recovery' : returning ? 'returning' : 'new';
    this.value = normalizeSettings(raw, { ...defaults, onboardingStatus: policy }, constraints);
    return this.current;
  }

  public get current(): GameSettings { return structuredClone(this.value); }
  public subscribe(listener: (settings: GameSettings) => void): () => void {
    this.listeners.add(listener); return () => this.listeners.delete(listener);
  }
  public update(changes: Partial<GameSettings>): boolean {
    if (changes.graphicsQuality && changes.graphicsQuality !== 'custom') changes = { ...changes, ...QUALITY_PRESETS[changes.graphicsQuality] };
    else if (changes.renderScale !== undefined || changes.particleQuality !== undefined) changes = { ...changes, graphicsQuality: 'custom' };
    this.value = normalizeSettings({ ...this.value, ...changes }, this.defaults, this.constraints);
    if (this.writeFailed) this.persisted = false;
    else {
      this.persisted = this.save(this.value);
      if (!this.persisted) this.writeFailed = true;
    }
    for (const listener of this.listeners) listener(this.current);
    return this.persisted;
  }
  public rebind(action: ActionId, code: string): string | null {
    if (action === 'pause' || !isSafeBinding(code)) return 'That key is reserved. Escape always pauses or cancels.';
    const conflict = ACTION_IDS.find((id) => id !== action && this.value.keyBindings[id] === code);
    if (conflict) return `${bindingLabel(code)} is already assigned to ${ACTION_LABELS[conflict]}. Choose another key.`;
    this.update({ keyBindings: { ...this.value.keyBindings, [action]: code } }); return null;
  }
  public resetControls(): void { this.update({ keyBindings: { ...DEFAULT_KEY_BINDINGS } }); }
  public resetSettings(): void {
    this.update({ ...this.defaults, onboardingStatus: this.value.onboardingStatus, onboardingCompleted: this.value.onboardingCompleted, tutorialCompleted: this.value.tutorialCompleted });
  }
  public retrySave(): boolean { this.writeFailed = false; return this.update({}); }

  public save(settings: GameSettings): boolean {
    if (!this.storage) return false;
    try {
      this.storage.setItem(this.key, JSON.stringify({ ...settings, schemaVersion: SETTINGS_SCHEMA_VERSION }));
      return true;
    } catch {
      return false;
    }
  }

  public clear(): boolean {
    if (!this.storage?.removeItem) return false;
    try {
      this.storage.removeItem(this.key);
      return true;
    } catch {
      return false;
    }
  }
}

function clamp(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, minimum), maximum)
    : fallback;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function enumOr<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === 'string' && values.includes(value as T) ? value as T : fallback;
}

export function isSafeBinding(value: string): boolean {
  return /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|ShiftLeft|Tab|Enter|Backspace|BracketLeft|BracketRight|Comma|Period|Slash|Minus|Equal)$/.test(value);
}

export const QUALITY_PRESETS = {
  low: { renderScale: 0.5, particleQuality: 'low' },
  medium: { renderScale: 0.75, particleQuality: 'low' },
  high: { renderScale: 1, particleQuality: 'high' },
} as const;
export const ACTION_LABELS: Record<ActionId, string> = {
  moveForward: 'Move forward', moveBackward: 'Move backward', moveLeft: 'Strafe left', moveRight: 'Strafe right',
  jump: 'Jump', sprint: 'Sprint', reload: 'Reload', primaryWeapon: 'Primary weapon', secondaryWeapon: 'Secondary weapon',
  nextWeapon: 'Cycle weapon', tactical: 'Tactical equipment', utility: 'Utility equipment', interact: 'Interact', pause: 'Pause / back', scoreboard: 'Scoreboard',
};
export function bindingLabel(code: string): string { return code.replace(/^Key|^Digit/, '').replace('ShiftLeft', 'Shift').replace('Arrow', 'Arrow '); }

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
