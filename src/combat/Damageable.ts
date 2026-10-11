import type { DamageRequest, DamageResult, HitRegionBinding } from './DamageTypes';
import type * as THREE from 'three';

export interface Damageable {
  readonly entityId: string;
  readonly teamId?: string;
  readonly root: THREE.Object3D;
  readonly maxHealth: number;
  get health(): number;
  get isDefeated(): boolean;
  getHitRegions(): readonly HitRegionBinding[];
  receiveDamage(request: DamageRequest): DamageResult;
  reset(): void;
  update(deltaSeconds: number): void;
}
