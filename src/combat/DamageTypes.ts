import * as THREE from 'three';

export type HitRegion = 'body' | 'critical';

export interface DamageRequest {
  sourceId: string;
  targetId: string;
  weaponId: string;
  baseDamage: number;
  finalDamage: number;
  distance: number;
  range: number;
  falloffMultiplier: number;
  criticalMultiplier: number;
  hitRegion: HitRegion;
  impactPoint: THREE.Vector3;
  shotDirection: THREE.Vector3;
  simulationTime: number;
}

export interface DamageResult {
  applied: boolean;
  damage: number;
  critical: boolean;
  defeated: boolean;
  targetId: string;
  impactPoint: THREE.Vector3;
}

export interface HitRegionBinding {
  object: THREE.Object3D;
  region: HitRegion;
  damageMultiplier: number;
}
