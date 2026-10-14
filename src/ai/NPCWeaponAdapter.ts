import * as THREE from 'three';
import type { CombatEventBus } from '../combat/CombatEvents';
import type { DamageSystem } from '../combat/DamageSystem';
import type { Damageable } from '../combat/Damageable';
import type { CollisionWorld } from '../physics/CollisionWorld';
import { WeaponRuntime } from '../weapons/WeaponRuntime';
import type { WeaponDefinition } from '../weapons/WeaponTypes';

export class NPCWeaponAdapter {
  public readonly runtime: WeaponRuntime;
  private readonly collisionWorld: CollisionWorld;
  private readonly damageSystem: DamageSystem;
  private readonly eventBus: CombatEventBus;
  private readonly sourceId: string;
  private target: Damageable | null;
  private simulationTime = 0;

  public constructor(
    definition: WeaponDefinition,
    sourceId: string,
    target: Damageable | null,
    collisionWorld: CollisionWorld,
    damageSystem: DamageSystem,
    eventBus: CombatEventBus,
  ) {
    this.runtime = new WeaponRuntime(definition);
    this.sourceId = sourceId;
    this.target = target;
    this.collisionWorld = collisionWorld;
    this.damageSystem = damageSystem;
    this.eventBus = eventBus;
  }

  public setTarget(target: Damageable | null): void {
    this.target = target;
  }

  public update(deltaSeconds: number): void {
    this.simulationTime += Math.max(deltaSeconds, 0);
    this.runtime.update(deltaSeconds);
  }

  public tryFire(origin: THREE.Vector3, direction: THREE.Vector3, aimError: number): boolean {
    if (!this.runtime.consumeShot()) {
      return false;
    }
    this.eventBus.emit({ type: 'weapon-fired', weapon: this.runtime.definition, shotCount: 1, sourceId: this.sourceId });
    const shotDirection = applyAimError(direction, aimError);
    const worldHit = this.collisionWorld.raycastStaticWorld(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: shotDirection.x, y: shotDirection.y, z: shotDirection.z },
      this.runtime.definition.range,
    );
    if (!this.target || this.target.isDefeated) {
      return true;
    }
    const targetPosition = this.target.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1, 0));
    const toTarget = targetPosition.clone().sub(origin);
    const distance = toTarget.length();
    const projection = toTarget.dot(shotDirection);
    const closestPoint = origin.clone().addScaledVector(shotDirection, projection);
    const targetRadius = 0.75;
    const targetHit = projection > 0
      && projection <= this.runtime.definition.range
      && (!worldHit || projection <= worldHit.distance + 0.01)
      && closestPoint.distanceToSquared(targetPosition) <= targetRadius * targetRadius
      && distance <= this.runtime.definition.range;

    if (targetHit) {
      const result = this.damageSystem.applyWeaponHit(
        this.target,
        this.runtime.definition,
        'body',
        distance,
        closestPoint,
        shotDirection,
        this.simulationTime,
        1,
        this.sourceId,
      );
      return result.applied;
    }
    return true;
  }

  public startReload(): boolean {
    return this.runtime.startReload();
  }
}

function applyAimError(direction: THREE.Vector3, error: number): THREE.Vector3 {
  if (error <= 0) {
    return direction.clone().normalize();
  }
  const result = direction.clone().normalize();
  const right = new THREE.Vector3().crossVectors(result, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, result).normalize();
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random()) * error;
  return result.addScaledVector(right, Math.cos(angle) * radius).addScaledVector(up, Math.sin(angle) * radius).normalize();
}
