import * as THREE from 'three';
import type { CombatEventBus } from '../combat/CombatEvents';
import type { DamageSystem } from '../combat/DamageSystem';
import type { Damageable } from '../combat/Damageable';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { CombatTargetRegistry } from '../combat/HitDetection';
import type { MapInstance } from '../world/MapInstance';
import { getNPCArchetype } from './NPCDefinitions';
import type { NPCArchetypeDefinition } from './NPCDefinitions';
import { NPCController, type NPCDebugSnapshot } from './NPCController';
import type { DifficultyConfig } from './NPCDifficulty';
import type { GameModeId } from '../match/MatchTypes';
import type { VisibilityBlocker } from './NPCPerception';
import type { TacticalEquipmentService } from '../tactical/TacticalEquipmentService';

export interface NPCEncounterSummary {
  total: number;
  active: number;
  defeated: number;
  states: Readonly<Record<string, number>>;
}

export interface NPCMatchRoster {
  modeId: GameModeId;
  count: number;
  respawnsEnabled: boolean;
}

export class NPCManager {
  private readonly npcs: NPCController[] = [];
  private readonly playerHealth: Damageable;
  private readonly damageSystem: DamageSystem;
  private readonly targetRegistry: CombatTargetRegistry;
  private readonly scene: THREE.Scene;
  private readonly collisionWorld: CollisionWorld;
  private readonly eventBus: CombatEventBus;
  private difficulty: DifficultyConfig['id'];
  private enabled = false;
  private simulationTime = 0;
  private spawnPositions: THREE.Vector3[] = [];
  private roster: NPCMatchRoster = { modeId: 'free-for-all', count: 4, respawnsEnabled: true };
  private objectiveDestinations: THREE.Vector3[] = [];

  public constructor(
    scene: THREE.Scene,
    collisionWorld: CollisionWorld,
    playerHealth: Damageable,
    damageSystem: DamageSystem,
    targetRegistry: CombatTargetRegistry,
    eventBus: CombatEventBus,
    difficulty: DifficultyConfig['id'] = 'normal',
    private readonly visibilityBlocker: VisibilityBlocker | null = null,
    private readonly tacticalEquipment: TacticalEquipmentService | null = null,
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
    const desiredCount = Math.min(Math.max(Math.floor(this.roster.count), 0), map.npcSpawns.length);
    for (const [index, spawn] of map.npcSpawns.slice(0, desiredCount).entries()) {
      const archetype = spawn.archetype ?? fallbackArchetypes[index % fallbackArchetypes.length];
      const teamId = this.getTeamId(index, spawn.id);
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
        teamId,
        this.visibilityBlocker,
        this.tacticalEquipment,
      );
      npc.setRespawnEnabled(this.roster.respawnsEnabled);
      npc.setObjectiveDestination(this.objectiveDestinations[index % Math.max(this.objectiveDestinations.length, 1)] ?? null);
      this.npcs.push(npc);
      this.tacticalEquipment?.registerNpc(npc.entityId, archetype);
      this.damageSystem.register(npc);
      this.targetRegistry.register(npc);
    }
    for (const npc of this.npcs) npc.setActive(this.enabled);
  }

  public configureRoster(roster: NPCMatchRoster): void {
    this.roster = { ...roster, count: Math.max(Math.floor(roster.count), 0) };
  }
  /** Staged mission rosters still instantiate the normal AI/combat controller. */
  public spawnMissionEncounter(map: MapInstance, units: readonly { id: string; archetype: NPCArchetypeDefinition['id']; position: THREE.Vector3; destination: THREE.Vector3 }[]): string[] {
    if (this.npcs.length + units.length > 8) throw new Error('Mission NPC population limit exceeded');
    for (const unit of units) {
      if (this.npcs.some((npc) => npc.entityId === unit.id) || !this.collisionWorld.isCapsuleClear(unit.position)) throw new Error(`Invalid mission NPC spawn: ${unit.id}`);
    }
    const created: string[] = [];
    try {
      for (const unit of units) {
        const npc = new NPCController(unit.id, getNPCArchetype(unit.archetype), this.difficulty, unit.position, this.scene, this.collisionWorld, map.navigationGraph, map.coverRegistry, this.playerHealth, this.damageSystem, this.eventBus, [unit.destination], 'enemy', this.visibilityBlocker, this.tacticalEquipment);
        npc.setRespawnEnabled(false); npc.setObjectiveDestination(unit.destination); npc.setActive(this.enabled);
        this.spawnPositions[this.npcs.length] = unit.position.clone(); this.npcs.push(npc); created.push(unit.id);
        this.tacticalEquipment?.registerNpc(unit.id, unit.archetype); this.damageSystem.register(npc); this.targetRegistry.register(npc);
      }
      return created;
    } catch (error) { this.clearMap(); throw error; }
  }

  public setDifficulty(difficulty: DifficultyConfig['id']): void {
    this.difficulty = difficulty;
  }

  public setObjectiveDestinations(destinations: readonly THREE.Vector3[]): void {
    this.objectiveDestinations = destinations.map((destination) => destination.clone());
    for (const [index, npc] of this.npcs.entries()) npc.setObjectiveDestination(this.objectiveDestinations[index % Math.max(this.objectiveDestinations.length, 1)] ?? null);
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
    const targets = new Map<string, Damageable | null>();
    for (const npc of this.npcs) {
      npc.selectCombatTarget(this.getCandidates(npc));
      targets.set(npc.entityId, npc.getCombatTarget());
    }
    for (const npc of this.npcs) {
      const target = targets.get(npc.entityId) ?? null;
      npc.setCombatTarget(target);
      npc.setTargetPosition(target?.root.getWorldPosition(new THREE.Vector3()) ?? playerPosition);
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
    this.objectiveDestinations = [];
  }

  public getSnapshots(): readonly NPCDebugSnapshot[] {
    return this.npcs.map((npc) => npc.getDebugSnapshot());
  }

  public getParticipantPositions(): readonly { id: string; teamId: string; alive: boolean; position: THREE.Vector3 }[] {
    return this.npcs.map((npc) => {
      const snapshot = npc.getDebugSnapshot();
      return { id: snapshot.id, teamId: snapshot.teamId, alive: snapshot.health > 0, position: snapshot.position };
    });
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
      this.tacticalEquipment?.unregisterNpc(npc.entityId);
    }
    this.npcs.length = 0;
  }

  private getCandidates(npc: NPCController): Damageable[] {
    return [this.playerHealth, ...this.npcs]
      .filter((candidate) => candidate.entityId !== npc.entityId && !candidate.isDefeated)
      .filter((candidate) => this.isValidTarget(npc, candidate));
  }

  private isValidTarget(npc: NPCController, candidate: Damageable): boolean {
    if (this.roster.modeId === 'survival') return candidate.entityId === this.playerHealth.entityId;
    if (this.roster.modeId === 'free-for-all') return true;
    if (this.roster.modeId === 'team-deathmatch' || this.roster.modeId === 'domination') return npc.teamId !== candidate.teamId;
    return false;
  }

  private getTeamId(index: number, spawnId: string): string {
    if (this.roster.modeId === 'free-for-all') return `ffa:${spawnId}`;
    if (this.roster.modeId === 'team-deathmatch' || this.roster.modeId === 'domination') return index % 2 === 0 ? 'player' : 'enemy';
    return 'enemy';
  }
}
