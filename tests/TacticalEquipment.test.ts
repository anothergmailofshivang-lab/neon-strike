import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CombatEventBus } from '../src/combat/CombatEvents';
import { DamageSystem } from '../src/combat/DamageSystem';
import type { Damageable } from '../src/combat/Damageable';
import type { DamageRequest, DamageResult } from '../src/combat/DamageTypes';
import { getEquipmentDefinition } from '../src/equipment/EquipmentCatalog';
import { EquipmentRuntime } from '../src/equipment/EquipmentRuntime';
import { VisibilityFieldRegistry } from '../src/tactical/VisibilityFieldRegistry';

class TestTarget implements Damageable {
  public readonly root = new THREE.Group();
  public readonly teamId = 'enemy';
  public readonly maxHealth = 100;
  public readonly entityId = 'target';
  public health = this.maxHealth;
  public get isDefeated(): boolean { return this.health <= 0; }
  public getHitRegions(): readonly [] { return []; }
  public receiveDamage(request: DamageRequest): DamageResult {
    const amount = Math.min(this.health, request.finalDamage);
    this.health -= amount;
    return { applied: amount > 0, damage: amount, critical: false, defeated: this.isDefeated, targetId: this.entityId, impactPoint: request.impactPoint.clone() };
  }
  public reset(): void { this.health = this.maxHealth; }
  public update(_deltaSeconds: number): void {}
}

describe('tactical equipment runtime', () => {
  it('consumes bounded charges and respects simulation cooldowns', () => {
    const runtime = new EquipmentRuntime(getEquipmentDefinition('frag-grenade'));
    expect(runtime.snapshot().charges).toBe(2);
    expect(runtime.tryConsume().accepted).toBe(true);
    expect(runtime.tryConsume().reason).toBe('COOLDOWN');
    runtime.update(0.35);
    expect(runtime.tryConsume().accepted).toBe(true);
    runtime.update(0.35);
    expect(runtime.tryConsume().reason).toBe('NO_CHARGES');
    expect(runtime.addCharges(1)).toBe(1);
  });

  it('applies direct equipment damage through the authoritative damage events', () => {
    const events = new CombatEventBus();
    const damage = new DamageSystem(events);
    const source: Damageable = { entityId: 'player', teamId: 'player', root: new THREE.Group(), maxHealth: 100, health: 100, isDefeated: false, getHitRegions: () => [], receiveDamage: () => ({ applied: false, damage: 0, critical: false, defeated: false, targetId: 'player', impactPoint: new THREE.Vector3() }), reset: () => {}, update: () => {} } as Damageable;
    const target = new TestTarget();
    damage.register(source);
    damage.register(target);
    const seen: string[] = [];
    events.subscribe((event) => seen.push(event.type));

    const result = damage.applyDirectDamage(target, 120, 'player', 'frag-grenade', { x: 0, y: 0, z: 0 }, 1);
    expect(result.defeated).toBe(true);
    expect(target.health).toBe(0);
    expect(seen).toEqual(['damage-applied', 'target-defeated']);
  });
});

describe('smoke visibility fields', () => {
  it('blocks NPC line of sight only while a field covers the segment', () => {
    const fields = new VisibilityFieldRegistry();
    fields.add('smoke', new THREE.Vector3(0, 1, 0), 2, 2);
    expect(fields.blocksLineOfSight(new THREE.Vector3(-4, 1, 0), new THREE.Vector3(4, 1, 0))).toBe(true);
    expect(fields.blocksLineOfSight(new THREE.Vector3(-4, 1, 5), new THREE.Vector3(4, 1, 5))).toBe(false);
    fields.update(2);
    expect(fields.blocksLineOfSight(new THREE.Vector3(-4, 1, 0), new THREE.Vector3(4, 1, 0))).toBe(false);
  });
});
