import type { SprintMode } from '../settings/SettingsService';

export type PlayerPosition = readonly [number, number, number];

export interface PlayerMovementConfig {
  walkSpeed: number;
  sprintSpeed: number;
  groundAcceleration: number;
  groundFriction: number;
  airAcceleration: number;
  airControl: number;
  jumpImpulse: number;
  gravity: number;
  maximumFallSpeed: number;
  collisionRadius: number;
  standingHeight: number;
  maximumWalkableSlope: number;
  groundSnapDistance: number;
  stepHeight: number;
  jumpBufferDuration: number;
  coyoteTimeDuration: number;
  outOfBoundsY: number;
}

export interface PlayerLookConfig {
  mouseSensitivity: number;
  verticalSensitivityMultiplier: number;
  minimumPitch: number;
  maximumPitch: number;
  defaultFieldOfView: number;
  minimumFieldOfView: number;
  maximumFieldOfView: number;
}

export interface PlayerCameraConfig {
  eyeHeight: number;
  headBobEnabled: boolean;
  headBobAmplitude: number;
  headBobFrequency: number;
  cameraEffectsEnabled: boolean;
  landingEffectEnabled: boolean;
}

export interface PlayerConfig {
  movement: PlayerMovementConfig;
  look: PlayerLookConfig;
  camera: PlayerCameraConfig;
  spawnPosition: PlayerPosition;
}

export interface PlayerSettings {
  mouseSensitivity: number;
  fieldOfView: number;
  invertY: boolean;
  sprintMode: SprintMode;
  headBobEnabled: boolean;
  cameraEffectsEnabled: boolean;
}

export const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
  movement: {
    walkSpeed: 8,
    sprintSpeed: 12,
    groundAcceleration: 50,
    groundFriction: 42,
    airAcceleration: 16,
    airControl: 0.45,
    jumpImpulse: 9.2,
    gravity: 25,
    maximumFallSpeed: 35,
    collisionRadius: 0.4,
    standingHeight: 1.8,
    maximumWalkableSlope: Math.PI / 4,
    groundSnapDistance: 0.15,
    stepHeight: 0.25,
    jumpBufferDuration: 0.08,
    coyoteTimeDuration: 0.05,
    outOfBoundsY: -12,
  },
  look: {
    mouseSensitivity: 0.0022,
    verticalSensitivityMultiplier: 1,
    minimumPitch: -Math.PI / 2 + 0.08,
    maximumPitch: Math.PI / 2 - 0.08,
    defaultFieldOfView: 70,
    minimumFieldOfView: 60,
    maximumFieldOfView: 100,
  },
  camera: {
    eyeHeight: 1.62,
    headBobEnabled: true,
    headBobAmplitude: 0.025,
    headBobFrequency: 10,
    cameraEffectsEnabled: true,
    landingEffectEnabled: true,
  },
  spawnPosition: [0, 0, 14],
};

export function validatePlayerConfig(config: PlayerConfig): PlayerConfig {
  const movement = config.movement;
  const look = config.look;
  const camera = config.camera;
  const positiveValues: Array<[number, string]> = [
    [movement.walkSpeed, 'walkSpeed'],
    [movement.sprintSpeed, 'sprintSpeed'],
    [movement.groundAcceleration, 'groundAcceleration'],
    [movement.groundFriction, 'groundFriction'],
    [movement.airAcceleration, 'airAcceleration'],
    [movement.jumpImpulse, 'jumpImpulse'],
    [movement.gravity, 'gravity'],
    [movement.maximumFallSpeed, 'maximumFallSpeed'],
    [movement.collisionRadius, 'collisionRadius'],
    [movement.standingHeight, 'standingHeight'],
    [look.mouseSensitivity, 'mouseSensitivity'],
    [look.verticalSensitivityMultiplier, 'verticalSensitivityMultiplier'],
    [camera.eyeHeight, 'eyeHeight'],
    [camera.headBobFrequency, 'headBobFrequency'],
  ];
  for (const [value, name] of positiveValues) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`PlayerConfig ${name} must be finite and greater than zero.`);
    }
  }

  const nonNegativeValues: Array<[number, string]> = [
    [movement.airControl, 'airControl'],
    [movement.groundSnapDistance, 'groundSnapDistance'],
    [movement.stepHeight, 'stepHeight'],
    [movement.jumpBufferDuration, 'jumpBufferDuration'],
    [movement.coyoteTimeDuration, 'coyoteTimeDuration'],
    [camera.headBobAmplitude, 'headBobAmplitude'],
  ];
  for (const [value, name] of nonNegativeValues) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`PlayerConfig ${name} must be finite and non-negative.`);
    }
  }

  if (!Number.isFinite(movement.outOfBoundsY)) {
    throw new Error('PlayerConfig outOfBoundsY must be finite.');
  }

  if (movement.sprintSpeed < movement.walkSpeed) {
    throw new Error('PlayerConfig sprintSpeed must not be lower than walkSpeed.');
  }
  if (movement.standingHeight <= movement.collisionRadius * 2) {
    throw new Error('PlayerConfig standingHeight must exceed two collider radii.');
  }
  if (look.minimumPitch >= look.maximumPitch) {
    throw new Error('PlayerConfig pitch limits are invalid.');
  }
  if (look.minimumFieldOfView >= look.maximumFieldOfView) {
    throw new Error('PlayerConfig field-of-view limits are invalid.');
  }
  if (camera.eyeHeight > movement.standingHeight) {
    throw new Error('PlayerConfig eyeHeight cannot exceed standingHeight.');
  }
  for (const value of config.spawnPosition) {
    if (!Number.isFinite(value)) {
      throw new Error('PlayerConfig spawnPosition must contain finite values.');
    }
  }

  return config;
}

export function createPlayerConfig(): PlayerConfig {
  return validatePlayerConfig({
    movement: { ...DEFAULT_PLAYER_CONFIG.movement },
    look: { ...DEFAULT_PLAYER_CONFIG.look },
    camera: { ...DEFAULT_PLAYER_CONFIG.camera },
    spawnPosition: [...DEFAULT_PLAYER_CONFIG.spawnPosition] as PlayerPosition,
  });
}

export function defaultPlayerSettings(config: PlayerConfig): PlayerSettings {
  return {
    mouseSensitivity: config.look.mouseSensitivity,
    fieldOfView: config.look.defaultFieldOfView,
    invertY: false,
    sprintMode: 'hold',
    headBobEnabled: config.camera.headBobEnabled,
    cameraEffectsEnabled: config.camera.cameraEffectsEnabled,
  };
}

export class PlayerSettingsStore {
  private readonly storage: Storage | null;
  private readonly key: string;

  public constructor(storage: Storage | null = getDefaultStorage(), key = 'neon-strike.player-settings') {
    this.storage = storage;
    this.key = key;
  }

  public load(defaults: PlayerSettings, config: PlayerConfig): PlayerSettings {
    if (!this.storage) {
      return { ...defaults };
    }

    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) {
        return { ...defaults };
      }
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return { ...defaults };
      }
      const candidate = parsed as Partial<PlayerSettings>;
      return {
        mouseSensitivity: clampNumber(candidate.mouseSensitivity, config.look.mouseSensitivity * 0.25, config.look.mouseSensitivity * 4, defaults.mouseSensitivity),
        fieldOfView: clampNumber(candidate.fieldOfView, config.look.minimumFieldOfView, config.look.maximumFieldOfView, defaults.fieldOfView),
        invertY: typeof candidate.invertY === 'boolean' ? candidate.invertY : defaults.invertY,
        sprintMode: candidate.sprintMode === 'toggle' ? 'toggle' : defaults.sprintMode,
        headBobEnabled: typeof candidate.headBobEnabled === 'boolean' ? candidate.headBobEnabled : defaults.headBobEnabled,
        cameraEffectsEnabled: typeof candidate.cameraEffectsEnabled === 'boolean' ? candidate.cameraEffectsEnabled : defaults.cameraEffectsEnabled,
      };
    } catch {
      return { ...defaults };
    }
  }

  public save(settings: PlayerSettings): void {
    if (!this.storage) {
      return;
    }

    try {
      this.storage.setItem(this.key, JSON.stringify(settings));
    } catch {
      // Settings persistence is optional; runtime controls remain functional.
    }
  }
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, minimum), maximum)
    : fallback;
}

function getDefaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
