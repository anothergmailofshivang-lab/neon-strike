import * as THREE from 'three';
import type { Damageable } from '../combat/Damageable';
import type { DamageRequest, DamageResult, HitRegionBinding } from '../combat/DamageTypes';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { MapDestructibleDefinition } from '../world/MapDefinition';

export class DestructibleObject implements Damageable {
  public readonly entityId: string;
  public readonly root = new THREE.Group();
  public readonly maxHealth: number;
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly definition: MapDestructibleDefinition;
  private readonly collisionWorld: CollisionWorld;
  private currentHealth: number;
  private defeated = false;

  public constructor(definition: MapDestructibleDefinition, collisionWorld: CollisionWorld) {
    this.definition = definition;
    this.collisionWorld = collisionWorld;
    this.entityId = definition.id;
    this.maxHealth = Math.max(definition.maxHealth, 1);
    this.currentHealth = this.maxHealth;
    this.root.name = `Destructible:${definition.id}`;
    this.root.position.set(...definition.position);
    this.material = new THREE.MeshStandardMaterial({ color: definition.materialColor, roughness: 0.72, metalness: 0.12 });
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(...definition.size), this.material);
    this.mesh.name = `${definition.id}:body`;
    this.root.add(this.mesh);
    this.collisionWorld.createBoxCollider(definition.id, definition.size, definition.position);
  }

  public get health(): number { return this.currentHealth; }
  public get isDefeated(): boolean { return this.defeated; }

  public getHitRegions(): readonly HitRegionBinding[] {
    return [{ object: this.mesh, region: 'body', damageMultiplier: this.definition.damageMultiplier ?? 1 }];
  }

  public receiveDamage(request: DamageRequest): DamageResult {
    if (this.defeated || request.targetId !== this.entityId || !Number.isFinite(request.finalDamage) || request.finalDamage <= 0) return { applied: false, damage: 0, critical: false, defeated: this.defeated, targetId: this.entityId, impactPoint: request.impactPoint.clone() };
    const damage = Math.min(this.currentHealth, Math.max(request.finalDamage, 0));
    this.currentHealth = Math.max(this.currentHealth - damage, 0);
    this.material.emissive.setHex(0xffd37a);
    this.material.emissiveIntensity = 1.6;
    if (this.health <= 0) {
      this.defeated = true;
      this.root.visible = false;
      this.collisionWorld.removeBoxCollider(this.definition.id);
    }
    return { applied: damage > 0, damage, critical: false, defeated: this.defeated, targetId: this.entityId, impactPoint: request.impactPoint.clone() };
  }

  public update(deltaSeconds: number): void {
    this.material.emissiveIntensity = Math.max(this.material.emissiveIntensity - Math.max(deltaSeconds, 0) * 8, 0);
  }

  public reset(): void {
    this.currentHealth = this.maxHealth;
    this.defeated = false;
    this.root.visible = true;
    this.material.emissiveIntensity = 0;
    this.collisionWorld.createBoxCollider(this.definition.id, this.definition.size, this.definition.position);
  }

  public dispose(): void {
    this.collisionWorld.removeBoxCollider(this.definition.id);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.root.clear();
  }
}
