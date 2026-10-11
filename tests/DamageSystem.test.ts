import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CombatEventBus } from '../src/combat/CombatEvents';
import { DamageSystem } from '../src/combat/DamageSystem';
import { TargetDummy } from '../src/targets/TargetDummy';
import { WEAPON_DEFINITIONS } from '../src/weapons/WeaponDefinitions';

describe('DamageSystem', () => {
  it('applies falloff and critical damage once through the damageable target', () => {
    const events = new CombatEventBus();
    const damage = new DamageSystem(events);
    const target = new TargetDummy({
      id: 'damage-test',
      position: [0, 0, -5],
      maxHealth: 100,
      respawnDelay: 4,
      accentColor: 0x00ffff,
    });
    damage.register(target);
    const weapon = WEAPON_DEFINITIONS.find((entry) => entry.id === 'pistol')!;
    const received: string[] = [];
    events.subscribe((event) => received.push(event.type));

    const result = damage.applyWeaponHit(
      target,
      weapon,
      'critical',
      10,
      new THREE.Vector3(0, 2, -5),
      new THREE.Vector3(0, 0, -1),
      1,
      weapon.criticalHitMultiplier,
    );

    expect(result.applied).toBe(true);
    expect(result.critical).toBe(true);
    expect(target.health).toBeLessThan(100);
    expect(received).toContain('damage-applied');
    expect(() => damage.applyWeaponHit(target, weapon, 'body', 10, new THREE.Vector3(), new THREE.Vector3(0, 0, -1), 2)).not.toThrow();
    target.dispose();
  });
});
