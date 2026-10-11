import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../src/physics/CollisionWorld';
import { MapManager } from '../src/world/MapManager';
import { createMapRegistry } from '../src/world/MapRegistry';
import { MAP_DEFINITIONS } from '../src/world/maps/MapCatalog';
import { MapLifecycleState } from '../src/world/MapDefinition';
import { AStarPathfinder } from '../src/navigation/AStarPathfinder';

describe('map lifecycle', () => {
  it('builds, validates, and pathfinds across all maps', async () => {
    const scene = new THREE.Scene();
    const collision = await CollisionWorld.create([]);
    const manager = new MapManager(scene, collision, createMapRegistry(MAP_DEFINITIONS));
    const pathfinder = new AStarPathfinder();

    for (const definition of MAP_DEFINITIONS) {
      const map = manager.load(definition.id);
      expect(manager.state).toBe(MapLifecycleState.ACTIVE);
      expect(manager.validation?.valid).toBe(true);
      expect(map.root.name).toContain(definition.displayName === 'NEON YARD' ? 'NeonYard' : definition.id === 'dustline-depot' ? 'DustlineDepot' : 'Skybridge');
      expect(map.collisionDefinitions.length).toBeGreaterThan(5);
      expect(map.coverRegistry.getAll().length).toBeGreaterThan(2);
      const nodes = map.navigationGraph.getAllNodes();
      expect(pathfinder.findPath(map.navigationGraph, nodes[0].id, nodes.at(-1)!.id)).not.toBeNull();
      expect(map.playerSpawns.length).toBeGreaterThan(0);
      expect(map.npcSpawns.length).toBeGreaterThan(2);
    }

    manager.unload();
    expect(manager.state).toBe(MapLifecycleState.UNLOADED);
    expect(scene.children).toHaveLength(0);
    collision.dispose();
  });

  it('does not keep the previous map root during switching', async () => {
    const scene = new THREE.Scene();
    const collision = await CollisionWorld.create([]);
    const manager = new MapManager(scene, collision, createMapRegistry(MAP_DEFINITIONS));
    const first = manager.load('neon-yard');
    const second = manager.load('skybridge');

    expect(first.root.parent).toBeNull();
    expect(second.root.parent).toBe(scene);
    expect(scene.children).toHaveLength(1);
    expect(second.definition.id).toBe('skybridge');

    manager.dispose();
    collision.dispose();
  });
});
