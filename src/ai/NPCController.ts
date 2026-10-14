import * as THREE from 'three';
import type { CombatEventBus } from '../combat/CombatEvents';
import type { Damageable } from '../combat/Damageable';
import type { DamageRequest, DamageResult, HitRegionBinding } from '../combat/DamageTypes';
import type { DamageSystem } from '../combat/DamageSystem';
import type { CollisionWorld } from '../physics/CollisionWorld';
import { createNPCVisual, type NPCVisual } from '../characters/NPCCharacterFactory';
import { CoverRegistry } from '../world/CoverRegistry';
import { NavigationGraph } from '../navigation/NavigationGraph';
import { getDifficulty, type DifficultyConfig } from './NPCDifficulty';
import { difficultyAdjustedPerception, type NPCArchetypeDefinition } from './NPCDefinitions';
import { NPCMemory } from './NPCMemory';
import { NPCNavigation } from './NPCNavigation';
import { NPCPerception, type VisibilityBlocker } from './NPCPerception';
import { NPCState } from './NPCState';
import { NPCStateMachine } from './NPCStateMachine';
import { NPCWeaponAdapter } from './NPCWeaponAdapter';
import { getWeaponDefinition } from '../weapons/WeaponDefinitions';
import type { TacticalEquipmentService } from '../tactical/TacticalEquipmentService';

export interface NPCDebugSnapshot {
  id: string;
  teamId: string;
  archetype: string;
  state: NPCState;
  health: number;
  maxHealth: number;
  visible: boolean;
  confidence: number;
  position: THREE.Vector3;
  destination: THREE.Vector3 | null;
  route: readonly string[];
  weaponId: string;
  stuck: boolean;
}

export class NPCController implements Damageable {
  public readonly entityId: string;
  public readonly teamId: string;
  public readonly root: THREE.Group;
  public readonly maxHealth: number;
  private readonly scene: THREE.Scene;
  private readonly collisionWorld: CollisionWorld;
  private readonly definition: NPCArchetypeDefinition;
  private readonly difficulty: DifficultyConfig;
  private readonly visual: NPCVisual;
  private readonly stateMachine = new NPCStateMachine(NPCState.IDLE);
  private readonly memory = new NPCMemory();
  private readonly perception: NPCPerception;
  private readonly navigation: NPCNavigation;
  private readonly cover: CoverRegistry;
  private readonly weapon: NPCWeaponAdapter;
  private readonly patrolPoints: readonly THREE.Vector3[];
  private readonly position = new THREE.Vector3();
  private readonly targetPosition = new THREE.Vector3();
  private readonly movement = new THREE.Vector3();
  private currentHealth: number;
  private currentTime = 0;
  private targetAcquiredAt = -Infinity;
  private nextDecisionAt = 0;
  private nextFireAt = 0;
  private destination: THREE.Vector3 | null = null;
  private patrolIndex = 0;
  private stuckTime = 0;
  private previousPosition = new THREE.Vector3();
  private active = true;
  private enabled = true;
  private respawnRemaining = 0;
  private readonly playerPosition = new THREE.Vector3();
  private readonly spawnPosition = new THREE.Vector3();
  private combatTarget: Damageable | null;
  private respawnEnabled = true;
  private objectiveDestination: THREE.Vector3 | null = null;
  private readonly tacticalEquipment: TacticalEquipmentService | null;
  private nextTacticalAt = 4;

  public constructor(
    id: string,
    definition: NPCArchetypeDefinition,
    difficulty: DifficultyConfig['id'],
    spawnPosition: THREE.Vector3,
    scene: THREE.Scene,
    collisionWorld: CollisionWorld,
    navigationGraph: NavigationGraph,
    cover: CoverRegistry,
    player: Damageable,
    damageSystem: DamageSystem,
    eventBus: CombatEventBus,
    patrolPoints: readonly THREE.Vector3[] = [],
    teamId = 'enemy',
    visibilityBlocker: VisibilityBlocker | null = null,
    tacticalEquipment: TacticalEquipmentService | null = null,
  ) {
    this.entityId = id;
    this.teamId = teamId;
    this.tacticalEquipment = tacticalEquipment;
    this.definition = definition;
    this.difficulty = getDifficulty(difficulty);
    this.maxHealth = definition.health;
    this.currentHealth = definition.health;
    this.combatTarget = player;
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.visual = createNPCVisual(definition);
    this.root = this.visual.root;
    this.root.position.copy(spawnPosition);
    this.position.copy(spawnPosition);
    this.previousPosition.copy(spawnPosition);
    this.spawnPosition.copy(spawnPosition);
    this.scene.add(this.root);
    this.collisionWorld.createActor({
      id,
      radius: definition.movement.collisionRadius,
      standingHeight: definition.movement.standingHeight,
      footPosition: [spawnPosition.x, spawnPosition.y, spawnPosition.z],
      controllerOffset: 0.03,
      maximumWalkableSlope: Math.PI / 4,
      groundSnapDistance: 0.15,
      stepHeight: 0.2,
    });
    this.perception = new NPCPerception(collisionWorld, difficultyAdjustedPerception(definition, this.difficulty), visibilityBlocker);
    this.navigation = new NPCNavigation(navigationGraph);
    this.cover = cover;
    this.weapon = new NPCWeaponAdapter(
      this.findWeaponDefinition(definition.weaponId),
      id,
      player,
      collisionWorld,
      damageSystem,
      eventBus,
    );
    this.patrolPoints = patrolPoints.map((point) => point.clone());
    this.patrolIndex = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    this.stateMachine.subscribe((transition) => {
      if (transition.next === NPCState.DEFEATED) {
        this.weapon.runtime.cancelReload();
      }
    });
  }

  public get health(): number {
    return this.currentHealth;
  }

  public get isDefeated(): boolean {
    return this.currentHealth <= 0;
  }

  public getHitRegions(): readonly HitRegionBinding[] {
    return [
      { object: this.visual.body, region: 'body', damageMultiplier: 1 },
      { object: this.visual.head, region: 'critical', damageMultiplier: 1 },
    ];
  }

  public receiveDamage(request: DamageRequest): DamageResult {
    if (this.isDefeated || request.targetId !== this.entityId || request.finalDamage <= 0) {
      return {
        applied: false,
        damage: 0,
        critical: false,
        defeated: this.isDefeated,
        targetId: this.entityId,
        impactPoint: request.impactPoint.clone(),
      };
    }
    const damage = Math.min(Math.max(request.finalDamage, 0), this.currentHealth);
    this.currentHealth = Math.max(this.currentHealth - damage, 0);
    this.memory.recordDamage(this.currentTime);
    this.visual.body.scale.setScalar(1.08);
    if (this.isDefeated) {
      this.stateMachine.transitionTo(NPCState.DEFEATED, 'health depleted', this.currentTime);
      this.root.visible = false;
      this.active = false;
      this.respawnRemaining = 5;
      this.collisionWorld.setActorEnabled(this.entityId, false);
    }
    return {
      applied: damage > 0,
      damage,
      critical: request.hitRegion === 'critical',
      defeated: this.isDefeated,
      targetId: this.entityId,
      impactPoint: request.impactPoint.clone(),
    };
  }

  public setTargetPosition(position: THREE.Vector3): void {
    this.playerPosition.copy(position);
  }

  public setCombatTarget(target: Damageable | null): void {
    if (target?.entityId !== this.combatTarget?.entityId) {
      this.memory.clear(); this.targetAcquiredAt = this.currentTime; this.nextDecisionAt = 0;
    }
    this.combatTarget = target;
    this.weapon.setTarget(target);
    if (target) {
      target.root.getWorldPosition(this.targetPosition);
      this.playerPosition.copy(this.targetPosition);
    }
  }

  public selectCombatTarget(candidates: readonly Damageable[]): void {
    if (this.tacticalEquipment?.isDisoriented(this.entityId)) { this.setCombatTarget(null); return; }
    const visible = candidates.filter((target) => this.perception.canSee(this.position, this.root.rotation.y, target.root.position.clone().add(new THREE.Vector3(0, 1, 0))))
      .sort((a, b) => a.root.position.distanceToSquared(this.position) - b.root.position.distanceToSquared(this.position) || a.entityId.localeCompare(b.entityId));
    this.setCombatTarget(visible[0] ?? (this.combatTarget && candidates.includes(this.combatTarget) ? this.combatTarget : null));
  }

  public getCombatTarget(): Damageable | null { return this.combatTarget; }

  public setObjectiveDestination(position: THREE.Vector3 | null): void { this.objectiveDestination = position?.clone() ?? null; }

  public setRespawnEnabled(enabled: boolean): void {
    this.respawnEnabled = enabled;
  }

  public getSquadContact(): THREE.Vector3 | null {
    const snapshot = this.memory.snapshot;
    return snapshot.targetVisible && snapshot.lastKnownPosition
      ? snapshot.lastKnownPosition.clone()
      : null;
  }

  public receiveSquadContact(position: THREE.Vector3, time: number): void {
    this.memory.receiveSquadContact(position, time);
  }

  public update(deltaSeconds: number, playerPosition = this.playerPosition): void {
    const delta = Math.max(deltaSeconds, 0);
    this.currentTime += delta;
    this.visual.body.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(delta * 10, 1));
    if (!this.enabled) {
      return;
    }
    if (!this.active) {
      if (!this.respawnEnabled) return;
      this.respawnRemaining = Math.max(this.respawnRemaining - delta, 0);
      if (this.respawnRemaining <= 0) {
        this.reset(this.spawnPosition);
        this.stateMachine.transitionTo(NPCState.RESPAWNING, 'respawn timer complete', this.currentTime);
      }
      return;
    }

    const playerSnapshot = this.combatTarget && !this.combatTarget.isDefeated
      ? this.combatTarget.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1, 0))
      : playerPosition.clone().add(new THREE.Vector3(0, 1, 0));
    const wasVisible = this.memory.snapshot.targetVisible;
    const observation = this.combatTarget && !this.combatTarget.isDefeated && !this.tacticalEquipment?.isDisoriented(this.entityId) ? this.perception.observe(
      this.position,
      this.root.rotation.y,
      playerSnapshot,
      this.memory,
      this.currentTime,
      this.difficulty.memoryDuration,
    ) : { visible: false, distance: Infinity, targetPosition: this.position.clone() };
    if (this.tacticalEquipment?.isDisoriented(this.entityId)) this.memory.loseVisual(this.currentTime, 0);
    if (observation.visible && !wasVisible) this.targetAcquiredAt = this.currentTime;
    this.weapon.update(delta);
    if (this.currentTime >= this.nextDecisionAt) {
      this.nextDecisionAt = this.currentTime + this.definition.decisionInterval * this.difficulty.decisionIntervalMultiplier;
      this.chooseAction(observation);
    }
    this.updateAction(delta, observation, playerSnapshot);
    this.visual.animate(delta, this.definition.movement.walkSpeed, this.destination !== null);
    this.updateStuck(delta);
  }

  public reset(spawnPosition = this.position): void {
    this.collisionWorld.setActorEnabled(this.entityId, true);
    this.collisionWorld.resetActor(this.entityId, [spawnPosition.x, spawnPosition.y, spawnPosition.z], this.definition.movement.standingHeight);
    this.position.copy(spawnPosition);
    this.previousPosition.copy(spawnPosition);
    this.root.position.copy(spawnPosition);
    this.root.visible = true;
    this.currentHealth = this.maxHealth;
    this.active = true;
    this.respawnRemaining = 0;
    this.destination = null;
    this.stuckTime = 0;
    this.nextDecisionAt = 0;
    this.nextFireAt = 0;
    this.nextTacticalAt = 4;
    this.targetAcquiredAt = -Infinity;
    this.memory.clear();
    this.navigation.clear();
    this.visual.animate(0, 0, false);
    this.weapon.runtime.reset();
    this.stateMachine.reset(this.currentTime);
  }

  public setActive(active: boolean): void {
    this.enabled = active;
  }

  public getDebugSnapshot(): NPCDebugSnapshot {
    const memory = this.memory.snapshot;
    return {
      id: this.entityId,
      teamId: this.teamId,
      archetype: this.definition.id,
      state: this.stateMachine.state,
      health: this.currentHealth,
      maxHealth: this.maxHealth,
      visible: memory.targetVisible,
      confidence: memory.confidence,
      position: this.position.clone(),
      destination: this.destination?.clone() ?? null,
      route: this.navigation.route,
      weaponId: this.weapon.runtime.definition.id,
      stuck: this.stuckTime > 0.5,
    };
  }

  public dispose(): void {
    this.collisionWorld.removeActor(this.entityId);
    this.scene.remove(this.root);
    this.visual.dispose();
  }

  private chooseAction(observation: { visible: boolean; distance: number; targetPosition: THREE.Vector3 }): void {
    if (this.isDefeated) {
      this.stateMachine.transitionTo(NPCState.DEFEATED, 'defeated', this.currentTime);
      return;
    }
    const memory = this.memory.snapshot;
    if (observation.visible) {
      if (this.tacticalEquipment && this.currentTime >= this.nextTacticalAt && this.currentTime - this.targetAcquiredAt >= this.difficulty.reactionDelay) {
        this.nextTacticalAt = this.currentTime + 2;
        if (this.tacticalEquipment.useNpc(this.entityId, this.getAimOrigin(), observation.targetPosition)) {
          this.nextTacticalAt = this.currentTime + 12;
          this.nextFireAt = this.currentTime + 0.6;
        }
      }
      this.targetPosition.copy(observation.targetPosition);
      const coverBias = this.definition.coverPreference * this.difficulty.coverPreferenceMultiplier;
      const aggressionBias = this.definition.aggression * this.difficulty.aggressionMultiplier;
      if (this.currentHealth / this.maxHealth <= this.definition.retreatHealthRatio) {
        this.stateMachine.transitionTo(NPCState.RETREAT, 'low health', this.currentTime);
      } else if (this.weapon.runtime.getSnapshot().state === 'EMPTY' && this.weapon.runtime.getSnapshot().reserveAmmo > 0) {
        this.stateMachine.transitionTo(NPCState.RELOAD, 'magazine empty', this.currentTime);
      } else if (coverBias > 1.2 && this.stateMachine.state === NPCState.ENGAGE && this.currentTime > 6) {
        this.stateMachine.transitionTo(NPCState.SEEK_COVER, 'cover preference', this.currentTime);
      } else if (observation.distance < this.definition.preferredRange.minimum && this.definition.id !== 'scout') {
        this.stateMachine.transitionTo(NPCState.REPOSITION, 'target too close', this.currentTime);
      } else if (observation.distance > this.definition.preferredRange.maximum) {
        this.stateMachine.transitionTo(NPCState.REPOSITION, 'target too far', this.currentTime);
      } else if (this.definition.flankPreference * aggressionBias > 1 && this.currentTime > 8 && this.stateMachine.state !== NPCState.FLANK) {
        this.stateMachine.transitionTo(NPCState.FLANK, 'alternate angle preferred', this.currentTime);
      } else {
        this.stateMachine.transitionTo(NPCState.ENGAGE, 'target visible', this.currentTime);
      }
    } else if (memory.lastKnownPosition && memory.confidence > 0.05) {
      this.targetPosition.copy(memory.lastKnownPosition);
      this.stateMachine.transitionTo(NPCState.SEARCH, 'lost visual contact', this.currentTime);
    } else {
      this.stateMachine.transitionTo(NPCState.PATROL, 'no target', this.currentTime);
    }
  }

  private updateAction(delta: number, observation: { visible: boolean; distance: number; targetPosition: THREE.Vector3 }, playerPosition: THREE.Vector3): void {
    if (this.stateMachine.state === NPCState.DEFEATED) {
      return;
    }
    if (this.stateMachine.state === NPCState.ENGAGE || this.stateMachine.state === NPCState.STRAFE) {
      this.destination = null;
      this.faceTarget(playerPosition, delta);
      if (observation.visible && this.currentTime - this.targetAcquiredAt >= this.difficulty.reactionDelay && this.currentTime >= this.nextFireAt) {
        const direction = playerPosition.clone().sub(this.getAimOrigin()).normalize();
        const aimError = this.getAimError(observation.distance);
        if (this.weapon.tryFire(this.getAimOrigin(), direction, aimError)) {
          this.nextFireAt = this.currentTime + this.weapon.runtime.definition.fireInterval;
        }
      }
      if (this.definition.id === 'scout' || this.definition.id === 'flanker') {
        this.moveLateral(delta);
      }
      return;
    }
    if (this.stateMachine.state === NPCState.RELOAD) {
      if (this.weapon.runtime.getSnapshot().state !== 'RELOADING') {
        this.weapon.startReload();
      }
      if (this.weapon.runtime.getSnapshot().state === 'READY') {
        this.stateMachine.transitionTo(NPCState.ENGAGE, 'reload complete', this.currentTime);
      }
      return;
    }
    if (this.stateMachine.state === NPCState.SEEK_COVER || this.stateMachine.state === NPCState.RETREAT) {
      const cover = this.cover.findBestCover(this.position, playerPosition, this.collisionWorld);
      this.destination = cover?.position.clone() ?? this.fallbackAwayFrom(playerPosition);
      this.moveTowardDestination(delta);
      return;
    }
    if (this.stateMachine.state === NPCState.FLANK) {
      const flank = this.findFlankDestination(playerPosition);
      this.destination = flank;
      this.moveTowardDestination(delta);
      if (this.navigation.isComplete) {
        this.stateMachine.transitionTo(NPCState.ENGAGE, 'flank route completed', this.currentTime);
      }
      return;
    }
    if (this.stateMachine.state === NPCState.SEARCH || this.stateMachine.state === NPCState.REPOSITION || this.stateMachine.state === NPCState.INVESTIGATE) {
      this.destination = this.targetPosition.clone();
      this.moveTowardDestination(delta);
      if (this.navigation.isComplete && this.position.distanceTo(this.targetPosition) < 2.5) {
        this.stateMachine.transitionTo(NPCState.SEARCH, 'searching last known position', this.currentTime);
      }
      return;
    }
    if (this.stateMachine.state === NPCState.PATROL || this.stateMachine.state === NPCState.IDLE || this.stateMachine.state === NPCState.RECOVER_NAVIGATION) {
      this.destination = this.objectiveDestination?.clone() ?? this.getPatrolDestination();
      this.moveTowardDestination(delta);
      if (this.navigation.isComplete) this.root.rotation.y += delta * 0.65;
    }
  }

  private moveTowardDestination(delta: number): void {
    if (!this.destination) return;
    if (!this.navigation.requestPath(this.position, this.destination)) {
      this.stateMachine.transitionTo(NPCState.RECOVER_NAVIGATION, 'no valid route', this.currentTime);
      this.destination = null;
      return;
    }
    const waypoint = this.navigation.getNextWaypoint(this.position);
    if (!waypoint) return;
    const direction = waypoint.sub(this.position);
    direction.y = 0;
    if (direction.lengthSq() < 0.001) return;
    direction.normalize();
    const speed = this.stateMachine.state === NPCState.RETREAT ? this.definition.movement.combatSpeed : this.definition.movement.walkSpeed;
    this.movement.copy(direction).multiplyScalar(speed * delta);
    const result = this.collisionWorld.moveActor(this.entityId, { x: this.movement.x, y: -0.12, z: this.movement.z });
    const corrected = this.collisionWorld.getActorFootPosition(this.entityId, this.definition.movement.standingHeight);
    this.position.set(corrected.x, corrected.y, corrected.z);
    this.root.position.copy(this.position);
    this.root.rotation.y = Math.atan2(-direction.x, -direction.z);
    if (result.collisionCount > 0 && this.movement.lengthSq() < 0.00001) {
      this.stuckTime += delta;
    }
  }

  private moveLateral(delta: number): void {
    const sign = Math.sin(Math.floor(this.currentTime * 0.8)) >= 0 ? 1 : -1;
    const lateral = new THREE.Vector3(-Math.cos(this.root.rotation.y) * sign, 0, -Math.sin(this.root.rotation.y) * sign);
    this.collisionWorld.moveActor(this.entityId, { x: lateral.x * this.definition.movement.combatSpeed * delta, y: -0.1, z: lateral.z * this.definition.movement.combatSpeed * delta });
    const corrected = this.collisionWorld.getActorFootPosition(this.entityId, this.definition.movement.standingHeight);
    this.position.set(corrected.x, corrected.y, corrected.z);
    this.root.position.copy(this.position);
  }

  private updateStuck(delta: number): void {
    const progress = this.position.distanceTo(this.previousPosition);
    this.previousPosition.copy(this.position);
    if (this.destination && progress < 0.01 && this.stateMachine.state !== NPCState.IN_COVER && this.stateMachine.state !== NPCState.ENGAGE) {
      this.stuckTime += delta;
    } else {
      this.stuckTime = Math.max(this.stuckTime - delta * 2, 0);
    }
    if (this.stuckTime > 1.2) {
      this.navigation.clear();
      this.destination = null;
      this.stuckTime = 0;
      this.stateMachine.transitionTo(NPCState.RECOVER_NAVIGATION, 'movement stalled', this.currentTime);
    }
  }

  private faceTarget(target: THREE.Vector3, delta: number): void {
    const direction = target.clone().sub(this.position);
    direction.y = 0;
    if (direction.lengthSq() < 0.001) return;
    const desired = Math.atan2(-direction.x, -direction.z);
    let difference = desired - this.root.rotation.y;
    while (difference > Math.PI) difference -= Math.PI * 2;
    while (difference < -Math.PI) difference += Math.PI * 2;
    this.root.rotation.y += Math.sign(difference) * Math.min(Math.abs(difference), this.definition.movement.turnSpeed * delta);
  }

  private getAimOrigin(): THREE.Vector3 {
    return this.position.clone().add(new THREE.Vector3(0, 1.25, 0));
  }

  private getAimError(distance: number): number {
    const distanceFactor = Math.min(distance / Math.max(this.definition.preferredRange.maximum, 1), 1.5);
    const base = this.definition.id === 'sniper' ? 0.008 : this.definition.id === 'scout' ? 0.035 : 0.018;
    return base * this.difficulty.aimErrorMultiplier * Math.max(distanceFactor, 0.5);
  }

  private fallbackAwayFrom(playerPosition: THREE.Vector3): THREE.Vector3 {
    const away = this.position.clone().sub(playerPosition).setY(0).normalize();
    return this.position.clone().addScaledVector(away, 8);
  }

  private findFlankDestination(playerPosition: THREE.Vector3): THREE.Vector3 {
    const away = this.position.clone().sub(playerPosition).setY(0).normalize();
    const side = new THREE.Vector3(-away.z, 0, away.x).multiplyScalar(this.definition.id === 'flanker' ? 12 : 8);
    return playerPosition.clone().add(away.multiplyScalar(8)).add(side);
  }

  private getPatrolDestination(): THREE.Vector3 {
    const destinations = this.patrolPoints.length > 0
      ? this.patrolPoints
      : [new THREE.Vector3(-12, 0, 13), new THREE.Vector3(12, 0, 13), new THREE.Vector3(-12, 0, -8), new THREE.Vector3(12, 0, -8)];
    const destination = destinations[this.patrolIndex % destinations.length];
    if (this.position.distanceTo(destination) < 2) this.patrolIndex += 1;
    return destination.clone();
  }

  private findWeaponDefinition(id: string): import('../weapons/WeaponTypes').WeaponDefinition {
    return getWeaponDefinition(id);
  }
}
