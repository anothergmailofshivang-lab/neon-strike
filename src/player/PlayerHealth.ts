import * as THREE from 'three';
import type { Damageable } from '../combat/Damageable';
import type { DamageRequest, DamageResult } from '../combat/DamageTypes';

export class PlayerHealth implements Damageable {
  public readonly entityId = 'player';
  public readonly root: THREE.Object3D;
  public readonly maxHealth: number;
  private currentHealth: number;
  private defeated = false;

  public constructor(root: THREE.Object3D, maxHealth = 100) {
    this.root = root;
    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth;
  }

  public get health(): number {
    return this.currentHealth;
  }

  public get isDefeated(): boolean {
    return this.defeated;
  }

  public getHitRegions(): readonly [] {
    return [];
  }

  public receiveDamage(request: DamageRequest): DamageResult {
    if (this.defeated || request.targetId !== this.entityId || !Number.isFinite(request.finalDamage) || request.finalDamage <= 0) {
      return {
        applied: false,
        damage: 0,
        critical: false,
        defeated: this.defeated,
        targetId: this.entityId,
        impactPoint: request.impactPoint.clone(),
      };
    }

    const damage = Math.min(Math.max(request.finalDamage, 0), this.currentHealth);
    this.currentHealth = Math.max(this.currentHealth - damage, 0);
    this.defeated = this.currentHealth <= 0;
    return {
      applied: damage > 0,
      damage,
      critical: false,
      defeated: this.defeated,
      targetId: this.entityId,
      impactPoint: request.impactPoint.clone(),
    };
  }

  public update(_deltaSeconds: number): void {
    // Player defeat and respawn are controlled by the encounter mode.
  }

  public reset(): void {
    this.currentHealth = this.maxHealth;
    this.defeated = false;
  }
}
