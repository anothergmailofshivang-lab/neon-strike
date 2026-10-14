import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../src/campaign/CampaignCatalog';
import { MissionSession } from '../src/campaign/MissionSession';
import { MissionRuntime } from '../src/campaign/MissionRuntime';
import { resolveMissionWorld } from '../src/campaign/MissionWorld';
import { MAP_DEFINITIONS } from '../src/world/maps/MapCatalog';
import { MapInstance } from '../src/world/MapInstance';
import { CollisionWorld } from '../src/physics/CollisionWorld';
import { InteractionManager } from '../src/tactical/InteractionManager';
import { DestructibleManager } from '../src/tactical/DestructibleManager';
import { DamageSystem } from '../src/combat/DamageSystem';
import { CombatEventBus } from '../src/combat/CombatEvents';
import { CombatTargetRegistry } from '../src/combat/HitDetection';
import { PlayerHealth } from '../src/player/PlayerHealth';
import { NPCManager } from '../src/ai/NPCManager';
import { MatchSession } from '../src/match/MatchSession';
import { createDefaultMatchSettings } from '../src/match/GameModeDefinitions';
import { MatchCombatTracker } from '../src/progression/MatchCombatTracker';
import { getWeaponDefinition, createWeaponCatalog } from '../src/weapons/WeaponDefinitions';
import { ProfileService } from '../src/progression/ProfileService';
import { ProgressionService } from '../src/progression/ProgressionService';
import { DEFAULT_PLAYER_LOADOUT } from '../src/loadouts/LoadoutDefinitions';

describe('real campaign world adapters', () => {
  const profiles = new ProfileService(null, DEFAULT_PLAYER_LOADOUT), progression = new ProgressionService(profiles, createWeaponCatalog());
  for (const definition of MISSIONS) it(`completes real objective/interaction/encounter/extraction sequence: ${definition.id}`, async () => {
    const mapDefinition = MAP_DEFINITIONS.find((m) => m.id === definition.mapId)!;
    const map = new MapInstance(mapDefinition, mapDefinition.build()), scene = new THREE.Scene(); scene.add(map.root);
    const world = await CollisionWorld.create(map.collisionDefinitions), bus = new CombatEventBus(), damage = new DamageSystem(bus), registry = new CombatTargetRegistry();
    const health = new PlayerHealth(new THREE.Group()), mission = new MissionSession(definition, 'normal'); scene.add(health.root);
    const match = new MatchSession({ ...createDefaultMatchSettings('survival', definition.mapId), countdownSeconds: 0 }, mission.sessionId, true);
    match.addParticipant({ id: 'player', teamId: 'player', kind: 'player', displayName: 'PLAYER' });
    const tracker = new MatchCombatTracker(match); const combatUnsubscribe = bus.subscribe((event) => tracker.combat(event));
    const npcs = new NPCManager(scene, world, health, damage, registry, bus), interactions = new InteractionManager(scene, world, () => mission.phase === 'active');
    const props = new DestructibleManager(world, damage, registry); props.setDefinitions(map.destructibles ?? []);
    interactions.setDefinitions(map.interactions ?? [], map.definition.doors ?? []);
    const layout = resolveMissionWorld(definition, map, world); map.navigationGraph = layout.graph;
    npcs.configureRoster({ modeId: 'survival', count: 0, respawnsEnabled: false }); npcs.setMap(map);
    const runtime = new MissionRuntime(mission, map, layout, npcs, match, interactions, bus, scene);
    mission.subscribe((event) => { if (event.type === 'resolved') match.resolve(event.result.reason, event.result.outcome === 'success' ? 'player' : null, event.result.outcome === 'success' ? 'victory' : 'defeat'); });
    match.subscribe((event) => { if (event.type === 'match-started') mission.activate(); });
    damage.setPolicy(() => match.phase === 'active');
    let steps = 0;
    const step = (position: THREE.Vector3) => { health.root.position.copy(position); match.update(0.1); interactions.update(0.1, [position], []); runtime.update(0.1, position); steps++; };
    const clearSpawnedHostiles = () => {
      for (const npc of npcs.getSnapshots().filter((n) => n.health > 0)) {
        const target = damage.getTarget(npc.id)!;
        for (let shot = 0; shot < 10 && !target.isDefeated; shot++) {
          const weapon = getWeaponDefinition('sniper-rifle'); bus.emit({ type: 'weapon-fired', sourceId: 'player', weapon, shotCount: 1 });
          damage.applyWeaponHit(target, weapon, 'body', 1, target.root.position.clone(), new THREE.Vector3(0, 0, -1), steps / 10, 1, 'player');
        }
        expect(target.isDefeated).toBe(true);
      }
    };
    try {
      mission.prepare(); match.start();
      expect(mission.phase).toBe('active');
      // The actual extraction region cannot end a mission before its prerequisites.
      step(new THREE.Vector3(...definition.objectives.find((o) => o.kind === 'extract')!.position!));
      expect(mission.phase).toBe('active');
      while (mission.phase === 'active' && steps < 1500) {
        const snapshot = mission.snapshot();
        const current = definition.objectives.find((o) => o.optional && mission.isObjectiveActive(o.id)) ?? definition.objectives.find((o) => mission.isObjectiveActive(o.id));
        expect(current, JSON.stringify(snapshot)).toBeDefined();
        if (!current) break;
        if (current.objectId) {
          const object = definition.objects.find((o) => o.id === current.objectId)!;
          let interacted = false;
          for (const [x, z] of [[0, -1.8], [0, 1.8], [-1.8, 0], [1.8, 0]]) {
            const player = new THREE.Vector3(object.position[0] + x, 0.04, object.position[2] + z);
            if (!world.isCapsuleClear(player)) continue;
            step(player); clearSpawnedHostiles();
            const eye = player.clone().add(new THREE.Vector3(0, 1.6, 0)), forward = new THREE.Vector3(...object.position).sub(eye).normalize();
            if (interactions.getPrompt(eye, forward)?.startsWith(object.label)) {
              expect(interactions.interact(eye, forward)).toContain(object.label); interacted = true;
              if (object.kind === 'item') expect(runtime.group.getObjectByName(`MissionObject:${object.id}`)?.visible).toBe(false);
              break;
            }
          }
          expect(interacted, object.id).toBe(true);
        } else {
          const point = current.kind === 'escape' ? layout.spawn.clone() : current.position ? new THREE.Vector3(...current.position) : layout.spawn.clone();
          step(point); clearSpawnedHostiles();
        }
      }
      expect(mission.result?.outcome).toBe('success'); expect(match.phase).toBe('completed');
      expect(mission.result?.optionalObjectives).toHaveLength(1);
      expect(npcs.getSummary().total).toBe(definition.encounters.reduce((n, e) => n + e.units.length, 0));
      const playerStats = match.getParticipant('player')!.stats;
      expect(playerStats.eliminations).toBe(npcs.getSummary().total);
      expect(tracker.snapshot().weapons[0].eliminations).toBe(playerStats.eliminations);
      expect(runtime.getMinimapStates()).toEqual([]);
      const reward = progression.finalizeMission(mission.result!, tracker.snapshot());
      expect(reward?.breakdown.some((r) => r.source === 'First mission completion')).toBe(true);
      expect(progression.finalizeMission(mission.result!, tracker.snapshot())).toBeNull();
      expect(progression.profile.campaign.records[definition.id].completedAt).toBeTruthy();
      if (definition.id === 'last-carrier') { expect(progression.profile.campaign.milestones).toContain('carrier-zero:complete'); expect(progression.profile.entitlements).toContain('title:signal-restored'); }
    } finally {
      runtime.dispose(); mission.dispose(); npcs.dispose(); props.dispose(); interactions.dispose(); combatUnsubscribe();
      expect(registry.regionsForRaycast).toHaveLength(0); expect(scene.getObjectByName(`Mission:${definition.id}`)).toBeUndefined();
      world.dispose(); map.dispose();
    }
  }, 20000);
});
