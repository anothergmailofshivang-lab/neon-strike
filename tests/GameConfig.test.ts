import { describe, expect, it } from 'vitest';
import { createGameConfig, validateGameConfig } from '../src/app/GameConfig';

describe('GameConfig', () => {
  it('creates a valid default configuration', () => {
    const config = createGameConfig();
    expect(config.targetSimulationHz).toBe(60);
    expect(config.camera.nearPlane).toBeLessThan(config.camera.farPlane);
  });

  it('rejects unsafe timing and camera configuration', () => {
    const config = createGameConfig();
    expect(() => validateGameConfig({ ...config, maxFrameDeltaSeconds: Number.NaN })).toThrow();
    expect(() => validateGameConfig({
      ...config,
      camera: { ...config.camera, nearPlane: config.camera.farPlane },
    })).toThrow();
    expect(() => validateGameConfig({
      ...config,
      maxSimulationStepsPerFrame: 1.5,
    })).toThrow();
  });
});
