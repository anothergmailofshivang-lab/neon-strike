import type { PlayerMovementState } from '../player/PlayerState';

export type FiringMode = 'automatic' | 'semiautomatic' | 'burst' | 'pellet' | 'energy';

export interface RecoilProfile {
  vertical: number;
  horizontal: number;
  recovery: number;
  maximumAccumulation: number;
}

export interface SpreadProfile {
  base: number;
  movingMultiplier: number;
  sustainedPerShot: number;
  maximum: number;
  recovery: number;
}

export interface DamageFalloff {
  startDistance: number;
  endDistance: number;
  minimumMultiplier: number;
}

export interface AimDownSightsSettings {
  supported: boolean;
  fovMultiplier: number;
  spreadMultiplier: number;
  sensitivityMultiplier: number;
}

export interface BurstSettings {
  shots: number;
  shotInterval: number;
  recovery: number;
}

export interface PelletSettings {
  count: number;
  spreadMultiplier: number;
}

export interface WeaponVisualSettings {
  primaryColor: number;
  secondaryColor: number;
  energyColor: number;
  scale: number;
}

export interface WeaponDefinition {
  id: string;
  displayName: string;
  category: 'primary' | 'secondary';
  description: string;
  firingMode: FiringMode;
  baseDamage: number;
  fireInterval: number;
  magazineCapacity: number;
  startingReserveAmmo: number;
  maximumReserveAmmo: number;
  reloadDuration: number;
  range: number;
  spread: SpreadProfile;
  recoil: RecoilProfile;
  criticalHitMultiplier: number;
  damageFalloff?: DamageFalloff;
  aimDownSights: AimDownSightsSettings;
  burst?: BurstSettings;
  pellets?: PelletSettings;
  visual: WeaponVisualSettings;
}

export enum WeaponRuntimeState {
  READY = 'READY',
  EMPTY = 'EMPTY',
  RELOADING = 'RELOADING',
  SWITCHING = 'SWITCHING',
}

export interface WeaponRuntimeSnapshot {
  weaponId: string;
  state: WeaponRuntimeState;
  magazineAmmo: number;
  reserveAmmo: number;
  magazineCapacity: number;
  reloadProgress: number;
  fireCooldown: number;
  aiming: boolean;
}

export interface WeaponHudState {
  weaponId: string;
  displayName: string;
  magazineAmmo: number;
  reserveAmmo: number;
  magazineCapacity: number;
  state: WeaponRuntimeState;
  reloadProgress: number;
  aiming: boolean;
  movementState: PlayerMovementState | null;
}
