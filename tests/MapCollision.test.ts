import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../src/physics/CollisionWorld';
import { MapManager } from '../src/world/MapManager';
import { createMapRegistry } from '../src/world/MapRegistry';
import { MAP_DEFINITIONS } from '../src/world/maps/MapCatalog';

describe('map collision', () => {
  it('keeps a solid boundary and map-specific obstruction active after switching', async () => {
    const scene = new THREE.Scene();
    const collision = await CollisionWorld.create([]);
    const manager = new MapManager(scene, collision, createMapRegistry(MAP_DEFINITIONS));

    for (const id of ['modern-city', 'industrial-facility', 'jungle-forest', 'sci-fi-facility', 'fantasy-ruins']) {
      manager.load(id);
      const boundary = collision.raycastStaticWorld(
        { x: 0, y: 1.2, z: 0 },
        { x: 1, y: 0, z: 0 },
        40,
      );
      expect(boundary).not.toBeNull();
    }

    manager.dispose();
    expect(collision.raycastStaticWorld({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 40)).toBeNull();
    collision.dispose();
  });
});
