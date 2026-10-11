import * as THREE from 'three';
import type { CombatEventBus } from '../combat/CombatEvents';
import type { DamageSystem } from '../combat/DamageSystem';
import type { Damageable } from '../combat/Damageable';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { CombatTargetRegistry } from '../combat/HitDetection';
import type { MapInstance } from '../world/MapInstance';
import { getNPCArchetype } from './NPCDefinitions';
import { NPCController, type NPCDebugSnapshot } from './NPCController';
import type { DifficultyConfig } from './NPCDifficulty';

export interface NPCEncounterSummary {
  total: number;
  active: number;
  defeated: number;
  states: Readonly<Record<string, number>>;
}

export class NPCManager {
  private readonly npcs: NPCController[] = [];
  private readonly playerHealth: Damageable;
  private readonly damageSystem: DamageSystem;
  private readonly targetRegistry: CombatTargetRegistry;
  private readonly scene: THREE.Scene;
  private readonly collisionWorld: CollisionWorld;
  private readonly eventBus: CombatEventBus;
  private readonly difficulty: DifficultyConfig['id'];
  private enabled = false;
  private simulationTime = 0;
  private spawnPositions: THREE.Vector3[] = [];

  public constructor(
    scene: THREE.Scene,
    collisionWorld: CollisionWorld,
    playerHealth: Damageable,
    damageSystem: DamageSystem,
    targetRegistry: CombatTargetRegistry,
    eventBus: CombatEventBus,
    difficulty: DifficultyConfig['id'] = 'normal',
  ) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.playerHealth = playerHealth;
    this.damageSystem = damageSystem;
    this.targetRegistry = targetRegistry;
    this.eventBus = eventBus;
    this.difficulty = difficulty;
    this.damageSystem.register(playerHealth);
  }

  public setMap(map: MapInstance): void {
    this.clearNpcs();
    this.spawnPositions = map.npcSpawns.map((spawn) => spawn.position.clone());
    const fallbackArchetypes = ['scout', 'rifleman', 'heavy', 'sniper'] as const;
    const patrolPoints = map.navigationGraph.getAllNodes().map((node) => node.position);
    for (const [index, spawn] of map.npcSpawns.entries()) {
      const archetype = spawn.archetype ?? fallbackArchetypes[index % fallbackArchetypes.length];
      const npc = new NPCController(
        `${map.definition.id}:${spawn.id}`,
        getNPCArchetype(archetype),
        this.difficulty,
        spawn.position,
        this.scene,
        this.collisionWorld,
        map.navigationGraph,
        map.coverRegistry,
        this.playerHealth,
        this.damageSystem,
        this.eventBus,
        patrolPoints,
      );
      this.npcs.push(npc);
      this.damageSystem.register(npc);
      this.targetRegistry.register(npc);
    }
    for (const npc of this.npcs) npc.setActive(this.enabled);
  }

  public setActive(active: boolean): void {
    this.enabled = active;
    for (const npc of this.npcs) {
      npc.setActive(active);
    }
  }

  public update(deltaSeconds: number, playerPosition: THREE.Vector3): void {
    if (!this.enabled) {
      return;
    }
    this.simulationTime += Math.max(deltaSeconds, 0);
    let squadContact: THREE.Vector3 | null = null;
    let contactSource: NPCController | null = null;
    for (const npc of this.npcs) {
      npc.setTargetPosition(playerPosition);
      npc.update(deltaSeconds);
      const contact = npc.getSquadContact();
      if (!squadContact && contact) {
        squadContact = contact;
        contactSource = npc;
      }
    }
    if (squadContact) {
      for (const npc of this.npcs) {
        if (npc !== contactSource) {
          npc.receiveSquadContact(squadContact, this.simulationTime);
        }
      }
    }
    this.playerHealth.update(deltaSeconds);
  }

  public reset(): void {
    this.playerHealth.reset();
    this.simulationTime = 0;
    this.npcs.forEach((npc, index) => {
      const spawn = this.spawnPositions[index];
      if (spawn) npc.reset(spawn);
    });
  }

  public clearMap(): void {
    this.clearNpcs();
    this.spawnPositions = [];
  }

  public getSnapshots(): readonly NPCDebugSnapshot[] {
    return this.npcs.map((npc) => npc.getDebugSnapshot());
  }

  public getSummary(): NPCEncounterSummary {
    const states: Record<string, number> = {};
    let defeated = 0;
    for (const npc of this.npcs) {
      const snapshot = npc.getDebugSnapshot();
      states[snapshot.state] = (states[snapshot.state] ?? 0) + 1;
      if (snapshot.health <= 0) defeated += 1;
    }
    return {
      total: this.npcs.length,
      active: this.npcs.length - defeated,
      defeated,
      states,
    };
  }

  public dispose(): void {
    this.clearNpcs();
    this.spawnPositions = [];
    this.damageSystem.unregister(this.playerHealth.entityId);
  }

  private clearNpcs(): void {
    for (const npc of this.npcs) {
      this.targetRegistry.unregister(npc.entityId);
      this.damageSystem.unregister(npc.entityId);
      npc.dispose();
    }
    this.npcs.length = 0;
  }
}
