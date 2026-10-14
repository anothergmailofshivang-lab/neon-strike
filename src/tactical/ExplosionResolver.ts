import * as THREE from 'three';
import type { DamageSystem } from '../combat/DamageSystem';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { EquipmentDefinition } from '../equipment/EquipmentTypes';

export function blastFalloff(distance: number, radius: number): number {
  return radius > 0 && distance >= 0 && distance < radius ? 1 - distance / radius : 0;
}

export function exposed(world: Pick<CollisionWorld, 'raycastStaticWorld'>, center: THREE.Vector3, target: THREE.Vector3, excludeBoxId?: string): boolean {
  const ray = target.clone().sub(center);
  const distance = ray.length();
  return distance < 0.01 || !world.raycastStaticWorld(center, ray.normalize(), Math.max(distance - 0.02, 0.01), excludeBoxId);
}

/** Freeze exposure before removing any crate, so target iteration order cannot change cover. */
export function resolveExplosion(world: CollisionWorld, damage: DamageSystem, ownerId: string, definition: EquipmentDefinition, center: THREE.Vector3, time: number): number {
  const candidates = damage.getTargets().filter((target) => !target.isDefeated).map((target) => {
    const position = target.root.getWorldPosition(new THREE.Vector3());
    if (target.teamId || target.entityId === 'player') position.y += 1;
    const falloff = blastFalloff(center.distanceTo(position), definition.radius);
    return { target, amount: falloff > 0 && exposed(world, center, position, target.entityId) ? definition.damage * falloff : 0 };
  });
  let total = 0;
  for (const { target, amount } of candidates) if (amount > 0) total += damage.applyDirectDamage(target, amount, ownerId, definition.id, center, time).damage;
  return total;
}
