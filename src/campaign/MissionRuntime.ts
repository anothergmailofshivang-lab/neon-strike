import * as THREE from 'three';
import type { NPCManager } from '../ai/NPCManager';
import type { CombatEventBus } from '../combat/CombatEvents';
import type { MapInstance } from '../world/MapInstance';
import type { InteractionManager } from '../tactical/InteractionManager';
import { ObjectiveManager, type ObjectiveMinimapState } from '../match/ObjectiveManager';
import type { MatchSession } from '../match/MatchSession';
import type { MissionWorldLayout } from './MissionWorld';
import { MissionSession } from './MissionSession';
import type { MissionObjectDefinition } from './CampaignTypes';

let runtimeSequence = 0;
/** Owns only mission meshes, interaction registrations, capture adapter, and combat subscription. */
export class MissionRuntime {
  public readonly group = new THREE.Group();
  private readonly captures: ObjectiveManager;
  private readonly cleanups: (() => void)[] = [];
  private readonly objects = new Map<string, { definition: MissionObjectDefinition; mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>; light: THREE.PointLight }>();
  private readonly markers = new Map<string, THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>>();
  private readonly token = ++runtimeSequence;
  private disposed = false;

  public constructor(public readonly session: MissionSession, private readonly map: MapInstance, private readonly layout: MissionWorldLayout,
    private readonly npcs: NPCManager, private readonly match: MatchSession, interactions: InteractionManager, events: CombatEventBus, scene: THREE.Scene) {
    this.group.name = `Mission:${session.definition.id}`; scene.add(this.group);
    this.captures = new ObjectiveManager(match);
    const pointIds = new Set(session.definition.objectives.filter((o) => o.kind === 'capture').map((o) => o.controlPointId));
    this.captures.setDefinitions(map.controlPoints.filter((p) => pointIds.has(p.id)), new Set(session.definition.objectives.filter((o) => o.kind === 'capture' && session.isCompleted(o.id)).map((o) => o.controlPointId!)));
    this.group.add(this.captures.group);
    for (const definition of session.definition.objects) {
      const material = new THREE.MeshStandardMaterial({ color: definition.kind === 'item' ? 0xffc26a : 0x518198, emissive: 0x20485b, emissiveIntensity: 0.6, roughness: 0.5 });
      const mesh = new THREE.Mesh(definition.kind === 'item' ? new THREE.OctahedronGeometry(0.28) : new THREE.BoxGeometry(0.5, 0.75, 0.2), material);
      mesh.position.set(...definition.position); mesh.name = `MissionObject:${definition.id}`;
      const light = new THREE.PointLight(0x63eaff, 0, 5); light.position.copy(mesh.position).add(new THREE.Vector3(0, 0.5, 0));
      this.group.add(mesh, light); this.objects.set(definition.id, { definition, mesh, light });
      const objective = session.definition.objectives.find((o) => o.objectId === definition.id)!;
      this.cleanups.push(interactions.registerTarget({ id: `mission:${definition.id}`, position: mesh.position, radius: 2.5,
        label: () => session.isObjectiveActive(objective.id) ? definition.label : null,
        activate: () => {
          if (!session.interact(definition.id)) return false;
          if (definition.opensDoorId) interactions.openDoor(definition.opensDoorId);
          this.syncPresentation(); return true;
        },
      }));
      if (session.isCompleted(objective.id) && definition.opensDoorId) interactions.openDoor(definition.opensDoorId);
    }
    for (const definition of session.definition.objectives) {
      if (definition.kind === 'capture') continue;
      const position = this.objectivePosition(definition.id);
      if (!position) continue;
      const color = definition.kind === 'extract' ? 0x73ffb0 : definition.optional ? 0xffc26a : 0x63eaff;
      const marker = new THREE.Mesh(new THREE.TorusGeometry(definition.radius ?? 0.65, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65, depthTest: true }));
      marker.rotation.x = Math.PI / 2; marker.position.copy(position).setY(position.y + 0.12); marker.name = `MissionMarker:${definition.id}`;
      this.group.add(marker); this.markers.set(definition.id, marker);
    }
    this.cleanups.push(events.subscribe((event) => {
      if (this.disposed) return;
      if ((event.type === 'damage-applied' || event.type === 'target-defeated') && !this.match.getParticipant(event.result.targetId)) return;
      if (event.type === 'damage-applied' && event.result.applied && event.result.targetId === 'player') session.damageTaken(event.result.damage);
      if (event.type === 'target-defeated' && event.result.applied) session.defeated(event.result.targetId);
    }));
    this.syncPresentation();
  }

  public update(seconds: number, player: THREE.Vector3): void {
    if (this.disposed || this.session.phase !== 'active') return;
    const participants = this.npcs.getParticipantPositions();
    for (const id of this.session.getReadyEncounters()) {
      const definition = this.session.definition.encounters.find((e) => e.id === id)!;
      const units = definition.units.map((unit) => ({ id: `${this.session.sessionId}:${this.token}:${id}:${unit.id}`, archetype: unit.archetype, position: this.layout.points.get(`spawn:${unit.spawnId}`)!.clone(), destination: this.layout.points.get(`encounter:${id}`)!.clone() }));
      // Defer a group if its authored entrance is occupied; never teleport it to the player.
      if (units.some((unit) => unit.position.distanceTo(player) < 5 || participants.some((p) => p.alive && p.position.distanceTo(unit.position) < 1.5))) continue;
      try {
        const members = this.npcs.spawnMissionEncounter(this.map, units);
        for (const unit of units) this.match.addParticipant({ id: unit.id, displayName: unit.archetype.toUpperCase(), teamId: 'enemy', kind: 'npc', archetype: unit.archetype });
        this.session.startEncounter(id, members);
      }
      catch (error) { this.session.fail(error instanceof Error ? error.message : 'Encounter could not be created'); return; }
    }
    const positions = this.npcs.getParticipantPositions();
    this.captures.setEnabledPoints(new Set(this.session.definition.objectives.filter((o) => o.kind === 'capture' && this.session.isObjectiveActive(o.id)).map((o) => o.controlPointId!)));
    this.captures.update(seconds, [{ id: 'player', teamId: 'player', alive: true, position: player }, ...positions.map((p) => ({ ...p, teamId: 'enemy' as const }))]);
    for (const state of this.captures.getStates()) this.session.captured(state.id, state.owner, state.progress, state.contested);
    this.session.update(seconds, player, positions.filter((p) => p.alive && p.teamId !== 'player').map((p) => p.position));
    this.syncPresentation(player);
  }

  public getMinimapStates(): ObjectiveMinimapState[] {
    const snapshot = this.session.snapshot();
    return this.session.definition.objectives.filter((o) => this.session.isObjectiveActive(o.id)).flatMap((o) => {
      const position = this.objectivePosition(o.id); if (!position) return [];
      const state = snapshot.objectives.find((entry) => entry.id === o.id)!;
      return [{ id: `mission:${o.id}`, displayName: o.kind === 'extract' ? 'E' : o.optional ? '?' : '!', position, owner: null, capturingTeam: null, contested: state.state === 'contested', progress: state.progress, markerKind: o.kind === 'extract' ? 'extraction' as const : o.optional ? 'optional' as const : 'mandatory' as const }];
    });
  }
  public dispose(): void {
    if (this.disposed) return; this.disposed = true;
    for (const cleanup of this.cleanups) cleanup(); this.cleanups.length = 0;
    this.captures.dispose();
    for (const { mesh } of this.objects.values()) { mesh.geometry.dispose(); mesh.material.dispose(); }
    for (const marker of this.markers.values()) { marker.geometry.dispose(); marker.material.dispose(); }
    this.objects.clear(); this.markers.clear(); this.group.clear(); this.group.removeFromParent();
  }
  private objectivePosition(id: string): THREE.Vector3 | null {
    const definition = this.session.definition.objectives.find((o) => o.id === id)!;
    return this.layout.points.get(`objective:${id}`)?.clone() ?? (definition.objectId ? this.layout.points.get(`object:${definition.objectId}`)?.clone() : null) ?? null;
  }
  private syncPresentation(player?: THREE.Vector3): void {
    this.captures.setEnabledPoints(new Set(this.session.definition.objectives.filter((o) => o.kind === 'capture' && this.session.isObjectiveActive(o.id)).map((o) => o.controlPointId!)));
    for (const [id, marker] of this.markers) marker.visible = this.session.isObjectiveActive(id) && (!player || marker.position.distanceTo(player) < 45);
    for (const { definition, mesh, light } of this.objects.values()) {
      const objective = this.session.definition.objectives.find((o) => o.objectId === definition.id)!;
      const completed = this.session.isCompleted(objective.id);
      mesh.visible = definition.kind !== 'item' || !completed;
      const enabled = completed ? definition.action !== 'disable' : Boolean(definition.initialActive);
      light.intensity = definition.kind === 'terminal' && enabled ? 8 : 0;
      mesh.material.emissiveIntensity = definition.kind === 'item' ? 0.6 : enabled ? 1.5 : 0.1;
    }
  }
}
