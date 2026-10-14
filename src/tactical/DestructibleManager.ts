import * as THREE from 'three';
import type { CombatTargetRegistry } from '../combat/HitDetection';
import type { DamageSystem } from '../combat/DamageSystem';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { MapDestructibleDefinition } from '../world/MapDefinition';
import { DestructibleObject } from './DestructibleObject';

export class DestructibleManager {
  public readonly group = new THREE.Group();
  private readonly objects: DestructibleObject[] = [];

  public constructor(private readonly collisionWorld: CollisionWorld, private readonly damage: DamageSystem, private readonly targets: CombatTargetRegistry) {
    this.group.name = 'DestructibleProps';
  }

  public setDefinitions(definitions: readonly MapDestructibleDefinition[]): void {
    this.clear();
    const ids = new Set<string>();
    for (const definition of definitions) {
      if (!definition.id || ids.has(definition.id) || !definition.position.every(Number.isFinite) || !definition.size.every((size) => Number.isFinite(size) && size > 0) || !Number.isFinite(definition.maxHealth) || definition.maxHealth <= 0) {
        console.warn('[NEON STRIKE] Invalid destructible definition skipped'); continue;
      }
      ids.add(definition.id);
      const object = new DestructibleObject(definition, this.collisionWorld);
      this.objects.push(object);
      this.group.add(object.root);
      this.damage.register(object);
      this.targets.register(object);
    }
  }

  public update(deltaSeconds: number): void { for (const object of this.objects) object.update(deltaSeconds); }
  public reset(): void { for (const object of this.objects) object.reset(); }

  public clear(): void {
    for (const object of this.objects) {
      this.targets.unregister(object.entityId);
      this.damage.unregister(object.entityId);
      object.dispose();
    }
    this.objects.length = 0;
    this.group.clear();
  }

  public dispose(): void { this.clear(); }
}
