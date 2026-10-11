import * as THREE from 'three';
import type { CombatEventBus } from './CombatEvents';
import type { Damageable } from './Damageable';
import type { DamageRequest, DamageResult, HitRegion } from './DamageTypes';
import type { WeaponDefinition } from '../weapons/WeaponTypes';

export class DamageSystem {
  private readonly eventBus: CombatEventBus;
  private readonly targets = new Map<string, Damageable>();
  private sequence = 0;

  public constructor(eventBus: CombatEventBus) {
    this.eventBus = eventBus;
  }

  public register(target: Damageable): void {
    if (this.targets.has(target.entityId)) {
      throw new Error(`Damageable target ID is already registered: ${target.entityId}`);
    }
    this.targets.set(target.entityId, target);
  }

  public unregister(targetId: string): void {
    this.targets.delete(targetId);
  }

  public getTarget(targetId: string): Damageable | null {
    return this.targets.get(targetId) ?? null;
  }

  public applyWeaponHit(
    target: Damageable,
    weapon: WeaponDefinition,
    hitRegion: HitRegion,
    distance: number,
    impactPoint: { x: number; y: number; z: number },
    shotDirection: { x: number; y: number; z: number },
    simulationTime: number,
    regionMultiplier = hitRegion === 'critical' ? weapon.criticalHitMultiplier : 1,
    sourceId = 'player',
  ): DamageResult {
    if (!this.targets.has(target.entityId) || target.isDefeated) {
      return {
        applied: false,
        damage: 0,
        critical: false,
        defeated: target.isDefeated,
        targetId: target.entityId,
        impactPoint: new THREE.Vector3(impactPoint.x, impactPoint.y, impactPoint.z),
      };
    }

    const falloffMultiplier = calculateFalloff(weapon, distance);
    const finalDamage = sanitizeDamage(weapon.baseDamage * falloffMultiplier * regionMultiplier);
    const request: DamageRequest = {
      sourceId,
      targetId: target.entityId,
      weaponId: weapon.id,
      baseDamage: weapon.baseDamage,
      finalDamage,
      distance,
      range: weapon.range,
      falloffMultiplier,
      criticalMultiplier: regionMultiplier,
      hitRegion,
      impactPoint: new THREE.Vector3(impactPoint.x, impactPoint.y, impactPoint.z),
      shotDirection: new THREE.Vector3(shotDirection.x, shotDirection.y, shotDirection.z),
      simulationTime: simulationTime + this.sequence++ * Number.EPSILON,
    };
    const result = target.receiveDamage(request);
    this.eventBus.emit({ type: 'damage-applied', request, result });
    if (result.critical) {
      this.eventBus.emit({ type: 'critical-hit', request, result });
    }
    if (result.defeated) {
      this.eventBus.emit({ type: 'target-defeated', request, result });
    }
    return result;
  }
}

function calculateFalloff(weapon: WeaponDefinition, distance: number): number {
  const falloff = weapon.damageFalloff;
  if (!falloff || distance <= falloff.startDistance) {
    return 1;
  }
  if (distance >= falloff.endDistance) {
    return falloff.minimumMultiplier;
  }
  const progress = (distance - falloff.startDistance) / (falloff.endDistance - falloff.startDistance);
  return 1 - progress * (1 - falloff.minimumMultiplier);
}

function sanitizeDamage(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
