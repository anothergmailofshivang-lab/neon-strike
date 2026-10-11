import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CombatEventBus } from '../src/combat/CombatEvents';
import { CombatTargetRegistry } from '../src/combat/HitDetection';
import { DamageSystem } from '../src/combat/DamageSystem';
import { PlayerHealth } from '../src/player/PlayerHealth';
import { CollisionWorld } from '../src/physics/CollisionWorld';
import { NPCManager } from '../src/ai/NPCManager';
import { getWeaponDefinition } from '../src/weapons/WeaponDefinitions';
import { createMapRegistry } from '../src/world/MapRegistry';
import { MapManager } from '../src/world/MapManager';
import { MAP_DEFINITIONS } from '../src/world/maps/MapCatalog';

describe('NPC encounter combat integration', () => {
  it('registers encounter actors with the shared damage system', async () => {
    const scene = new THREE.Scene();
    const collisionWorld = await CollisionWorld.create([]);
    const events = new CombatEventBus();
    const damageSystem = new DamageSystem(events);
    const targets = new CombatTargetRegistry();
    const player = new PlayerHealth(new THREE.Group());
    const mapManager = new MapManager(scene, collisionWorld, createMapRegistry(MAP_DEFINITIONS));
    const map = mapManager.load('neon-yard');
    const manager = new NPCManager(scene, collisionWorld, player, damageSystem, targets, events);
    manager.setMap(map);
    const scout = damageSystem.getTarget('neon-yard:neon-scout-west');

    expect(scout).not.toBeNull();
    expect(manager.getSummary().total).toBe(4);
    expect(targets.regionsForRaycast.length).toBe(8);

    const result = damageSystem.applyWeaponHit(
      scout!,
      getWeaponDefinition('sniper-rifle'),
      'critical',
      10,
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, -1),
      0,
    );
    expect(result.applied).toBe(true);
    expect(result.critical).toBe(true);
    expect(scout!.health).toBeLessThan(scout!.maxHealth);

    manager.dispose();
    mapManager.dispose();
    collisionWorld.dispose();
  });
});
