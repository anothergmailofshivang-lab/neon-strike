import type { DifficultyConfig } from '../ai/NPCDifficulty';

export interface GameConfig {
  applicationTitle: string;
  development: boolean;
  targetSimulationHz: number;
  maxFrameDeltaSeconds: number;
  maxSimulationStepsPerFrame: number;
  npcDifficulty: DifficultyConfig['id'];
  camera: {
    fieldOfView: number;
    nearPlane: number;
    farPlane: number;
  };
  renderer: {
    backgroundColor: number;
    maxPixelRatio: number;
    antialias: boolean;
    powerPreference: WebGLPowerPreference;
  };
  diagnostics: {
    enabledByDefault: boolean;
    refreshIntervalMs: number;
  };
}

const DEFAULT_CONFIG: GameConfig = {
  applicationTitle: 'NEON STRIKE',
  development: import.meta.env.DEV,
  targetSimulationHz: 60,
  maxFrameDeltaSeconds: 0.25,
  maxSimulationStepsPerFrame: 8,
  npcDifficulty: 'normal',
  camera: {
    fieldOfView: 60,
    nearPlane: 0.1,
    farPlane: 250,
  },
  renderer: {
    backgroundColor: 0x07111f,
    maxPixelRatio: 2,
    antialias: true,
    powerPreference: 'high-performance',
  },
  diagnostics: {
    enabledByDefault: import.meta.env.DEV,
    refreshIntervalMs: 250,
  },
};

function assertFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite number greater than zero.`);
  }
}

export function validateGameConfig(config: GameConfig): GameConfig {
  if (!config.applicationTitle.trim()) {
    throw new Error('applicationTitle must not be empty.');
  }

  assertFinitePositive(config.targetSimulationHz, 'targetSimulationHz');
  assertFinitePositive(config.maxFrameDeltaSeconds, 'maxFrameDeltaSeconds');
  assertFinitePositive(config.maxSimulationStepsPerFrame, 'maxSimulationStepsPerFrame');
  if (!Number.isInteger(config.maxSimulationStepsPerFrame)) {
    throw new Error('maxSimulationStepsPerFrame must be an integer.');
  }
  if (!['easy', 'normal', 'hard', 'expert'].includes(config.npcDifficulty)) {
    throw new Error(`Unsupported NPC difficulty: ${config.npcDifficulty}`);
  }
  assertFinitePositive(config.camera.fieldOfView, 'camera.fieldOfView');
  assertFinitePositive(config.camera.nearPlane, 'camera.nearPlane');
  assertFinitePositive(config.camera.farPlane, 'camera.farPlane');
  assertFinitePositive(config.renderer.maxPixelRatio, 'renderer.maxPixelRatio');
  assertFinitePositive(config.diagnostics.refreshIntervalMs, 'diagnostics.refreshIntervalMs');

  if (config.camera.nearPlane >= config.camera.farPlane) {
    throw new Error('camera.nearPlane must be smaller than camera.farPlane.');
  }

  if (config.camera.fieldOfView >= 180) {
    throw new Error('camera.fieldOfView must be smaller than 180 degrees.');
  }

  return config;
}

export function createGameConfig(): GameConfig {
  return validateGameConfig({
    ...DEFAULT_CONFIG,
    camera: { ...DEFAULT_CONFIG.camera },
    renderer: { ...DEFAULT_CONFIG.renderer },
    diagnostics: { ...DEFAULT_CONFIG.diagnostics },
  });
}
