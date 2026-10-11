import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../src/physics/CollisionWorld';
import { MapManager } from '../src/world/MapManager';
import { createMapRegistry } from '../src/world/MapRegistry';
import { MAP_DEFINITIONS } from '../src/world/maps/MapCatalog';

describe('map spawn validation', () => {
  it('keeps every player and NPC spawn above a supporting surface', async () => {
    const scene = new THREE.Scene();
    const collision = await CollisionWorld.create([]);
    const manager = new MapManager(scene, collision, createMapRegistry(MAP_DEFINITIONS));

    for (const definition of MAP_DEFINITIONS) {
      const map = manager.load(definition.id);
      for (const spawn of [...map.playerSpawns, ...map.npcSpawns]) {
        const hit = collision.raycastStaticWorld(
          { x: spawn.position.x, y: spawn.position.y + 8, z: spawn.position.z },
          { x: 0, y: -1, z: 0 },
          20,
        );
        expect(hit, `${definition.id}:${spawn.id}`).not.toBeNull();
      }
    }

    manager.dispose();
    collision.dispose();
  });
});
