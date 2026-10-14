import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../src/campaign/CampaignCatalog';
import { validateMissionCatalog } from '../src/campaign/MissionValidation';
import { resolveMissionWorld } from '../src/campaign/MissionWorld';
import { MAP_DEFINITIONS } from '../src/world/maps/MapCatalog';
import { MapInstance } from '../src/world/MapInstance';
import { CollisionWorld } from '../src/physics/CollisionWorld';
import { InteractionManager } from '../src/tactical/InteractionManager';
import { DestructibleManager } from '../src/tactical/DestructibleManager';
import { DamageSystem } from '../src/combat/DamageSystem';
import { CombatEventBus } from '../src/combat/CombatEvents';
import { CombatTargetRegistry } from '../src/combat/HitDetection';

describe('campaign definitions', () => {
  it('validates ten distinct operations across all five real maps', () => {
    expect(() => validateMissionCatalog(MISSIONS, MAP_DEFINITIONS)).not.toThrow();
    expect(MISSIONS).toHaveLength(10); expect(new Set(MISSIONS.map((m) => m.mapId)).size).toBe(5);
    expect(new Set(MISSIONS.map((m) => m.objectives.map((o) => o.kind).join(','))).size).toBeGreaterThanOrEqual(7);
  });
  it('rejects cycles, missing maps, impossible dependencies and unknown archetypes', () => {
    const change = (work: (missions: ReturnType<typeof structuredClone<typeof MISSIONS>>) => void) => { const copy = structuredClone(MISSIONS); work(copy); return copy; };
    expect(() => validateMissionCatalog(change((m) => { m[0].requires = ['last-carrier']; }), MAP_DEFINITIONS)).toThrow(/Cycle/);
    expect(() => validateMissionCatalog(change((m) => { m[0].mapId = 'missing'; }), MAP_DEFINITIONS)).toThrow(/map/);
    expect(() => validateMissionCatalog(change((m) => { m[0].objectives[0].requires = ['extract']; }), MAP_DEFINITIONS)).toThrow(/Cycle/);
    expect(() => validateMissionCatalog(change((m) => { m[0].objectives[0].requires = ['side-record']; }), MAP_DEFINITIONS)).toThrow(/optional/);
    expect(() => validateMissionCatalog(change((m) => { m[0].encounters[0].units[0].archetype = 'missing' as never; }), MAP_DEFINITIONS)).toThrow(/archetype/);
  });
  for (const mission of MISSIONS) it(`validates collision, floor support and connected routes: ${mission.id}`, async () => {
    const definition = MAP_DEFINITIONS.find((map) => map.id === mission.mapId)!;
    const map = new MapInstance(definition, definition.build()), world = await CollisionWorld.create(map.collisionDefinitions);
    const interactions = new InteractionManager(new THREE.Scene(), world, () => false);
    const props = new DestructibleManager(world, new DamageSystem(new CombatEventBus()), new CombatTargetRegistry());
    try {
      interactions.setDefinitions(map.interactions ?? [], definition.doors ?? []); props.setDefinitions(map.destructibles ?? []);
      const layout = resolveMissionWorld(mission, map, world);
      expect(layout.points.size).toBeGreaterThan(5); expect(layout.graph.getAllNodes().length).toBeLessThan(1200);
      expect(() => resolveMissionWorld({ ...mission, spawnId: 'removed-spawn' }, map, world)).toThrow(/Missing mission spawn/);
    } finally { interactions.dispose(); props.dispose(); world.dispose(); map.dispose(); }
  }, 15000);
});
