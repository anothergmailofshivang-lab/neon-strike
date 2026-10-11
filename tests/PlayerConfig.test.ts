import { describe, expect, it } from 'vitest';
import { createPlayerConfig, defaultPlayerSettings, PlayerSettingsStore, validatePlayerConfig } from '../src/player/PlayerConfig';

describe('PlayerConfig and settings', () => {
  it('provides tunable movement values and rejects invalid collider dimensions', () => {
    const config = createPlayerConfig();
    expect(config.movement.sprintSpeed).toBeGreaterThan(config.movement.walkSpeed);
    expect(config.camera.eyeHeight).toBeLessThan(config.movement.standingHeight);
    expect(() => validatePlayerConfig({
      ...config,
      movement: { ...config.movement, standingHeight: config.movement.collisionRadius * 2 },
    })).toThrow();
  });

  it('clamps malformed persisted settings to safe ranges', () => {
    const config = createPlayerConfig();
    const defaults = defaultPlayerSettings(config);
    const storage = {
      getItem: () => JSON.stringify({ mouseSensitivity: 100, fieldOfView: -20, headBobEnabled: false }),
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as Storage;
    const settings = new PlayerSettingsStore(storage).load(defaults, config);

    expect(settings.mouseSensitivity).toBeLessThanOrEqual(config.look.mouseSensitivity * 4);
    expect(settings.fieldOfView).toBe(config.look.minimumFieldOfView);
    expect(settings.headBobEnabled).toBe(false);
  });
});
