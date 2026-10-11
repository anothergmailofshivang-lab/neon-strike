import * as THREE from 'three';
import type { MapInstance } from '../world/MapInstance';
import type { MatchObjectiveState, TeamId } from './MatchTypes';
import { MatchSession } from './MatchSession';

export interface ObjectiveParticipantPosition {
  id: string;
  teamId: TeamId;
  alive: boolean;
  position: THREE.Vector3;
}

export interface ObjectiveMinimapState {
  id: string;
  displayName: string;
  position: THREE.Vector3;
  owner: TeamId | null;
  capturingTeam: TeamId | null;
  contested: boolean;
  progress: number;
}

export class ObjectiveManager {
  public readonly group = new THREE.Group();
  private readonly session: MatchSession;
  private readonly states = new Map<string, MatchObjectiveState>();
  private readonly rings = new Map<string, THREE.Mesh>();
  private readonly materials = new Map<string, THREE.MeshBasicMaterial>();
  private readonly labelMaterials = new Map<string, THREE.SpriteMaterial>();
  private readonly positions = new Map<string, THREE.Vector3>();
  private readonly radii = new Map<string, number>();
  private captureDuration = 5;
  private disposed = false;

  public constructor(session: MatchSession) {
    this.session = session;
    this.group.name = 'MatchObjectives';
  }

  public setMap(map: MapInstance | null): void {
    this.clear();
    if (!map || this.session.modeId !== 'domination') return;
    for (const definition of map.controlPoints) {
      const state: MatchObjectiveState = {
        id: definition.id,
        displayName: definition.displayName,
        owner: null,
        capturingTeam: null,
        progress: 0,
        contested: false,
        scoreAccumulator: 0,
      };
      this.states.set(definition.id, state);
      this.positions.set(definition.id, new THREE.Vector3(...definition.position));
      this.radii.set(definition.id, definition.radius);
      this.session.addObjective(state);
      const material = new THREE.MeshBasicMaterial({ color: 0x9eeaf4, transparent: true, opacity: 0.85 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(definition.radius, 0.08, 8, 32), material);
      ring.name = `ObjectiveMarker:${definition.id}`;
      ring.rotation.x = Math.PI / 2;
      ring.position.set(definition.position[0], definition.position[1] + 0.16, definition.position[2]);
      ring.userData.objectiveId = definition.id;
      this.group.add(ring);
      this.rings.set(definition.id, ring);
      this.materials.set(definition.id, material);
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 64;
      labelCanvas.height = 64;
      const labelContext = labelCanvas.getContext('2d');
      if (labelContext) {
        labelContext.fillStyle = '#06121d';
        labelContext.fillRect(5, 5, 54, 54);
        labelContext.strokeStyle = '#9eeaf4';
        labelContext.lineWidth = 4;
        labelContext.strokeRect(7, 7, 50, 50);
        labelContext.fillStyle = '#f4ffff';
        labelContext.font = 'bold 34px sans-serif';
        labelContext.textAlign = 'center';
        labelContext.textBaseline = 'middle';
        labelContext.fillText(definition.displayName.slice(0, 1), 32, 34);
      }
      const labelMaterial = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(labelCanvas), transparent: true, depthTest: false });
      const label = new THREE.Sprite(labelMaterial);
      label.name = `ObjectiveLabel:${definition.id}`;
      label.position.set(definition.position[0], definition.position[1] + 2.1, definition.position[2]);
      label.scale.set(0.8, 0.8, 0.8);
      this.group.add(label);
      this.labelMaterials.set(definition.id, labelMaterial);
    }
  }

  public update(deltaSeconds: number, participants: readonly ObjectiveParticipantPosition[]): void {
    if (this.disposed || this.session.phase !== 'active' || this.session.modeId !== 'domination') return;
    const delta = Math.min(Math.max(deltaSeconds, 0), 0.25);
    const awards = new Map<TeamId, number>();
    const contributors = new Map<TeamId, string[]>();
    for (const state of this.states.values()) {
      const point = this.positions.get(state.id);
      if (!point) continue;
      const present = participants.filter((participant) => participant.alive && participant.position.distanceTo(point) <= this.getRadius(state.id));
      const teams = new Set(present.map((participant) => participant.teamId));
      const previousOwner = state.owner;
      const previousContested = state.contested;
      const previousCapturingTeam = state.capturingTeam;
      const previousProgress = state.progress;
      state.contested = teams.size > 1;
      state.capturingTeam = null;
      if (!state.contested && teams.size === 1) {
        const [team] = teams;
        if (state.owner === team) {
          state.progress = 1;
        } else if (state.owner === null) {
          state.capturingTeam = team;
          state.progress = Math.min(state.progress + delta / this.captureDuration, 1);
          if (state.progress >= 1) state.owner = team;
        } else {
          state.capturingTeam = team;
          state.progress = Math.max(state.progress - delta / this.captureDuration, 0);
          if (state.progress === 0) state.owner = null;
        }
      } else if (state.contested) {
        state.progress = state.owner ? 1 : state.progress;
      }
      if (state.owner) {
        state.scoreAccumulator += delta;
        const scoreTicks = Math.floor(state.scoreAccumulator);
        if (scoreTicks > 0) {
          state.scoreAccumulator -= scoreTicks;
          awards.set(state.owner, (awards.get(state.owner) ?? 0) + scoreTicks);
          const ids = contributors.get(state.owner) ?? [];
          for (const participant of present) if (participant.teamId === state.owner && !ids.includes(participant.id)) ids.push(participant.id);
          contributors.set(state.owner, ids);
        }
      }
      if (previousOwner !== state.owner || previousContested !== state.contested || previousCapturingTeam !== state.capturingTeam || Math.abs(previousProgress - state.progress) >= 0.05) {
        this.session.updateObjective({ ...state });
      }
      this.updateMarker(state);
    }
    if (awards.size > 0) this.session.awardObjectiveTick(awards, contributors);
  }

  public getStates(): readonly MatchObjectiveState[] {
    return [...this.states.values()].map((state) => ({ ...state }));
  }

  public getMinimapStates(): readonly ObjectiveMinimapState[] {
    return [...this.states.values()].map((state) => ({
      id: state.id,
      displayName: state.displayName,
      position: this.positions.get(state.id)?.clone() ?? new THREE.Vector3(),
      owner: state.owner,
      capturingTeam: state.capturingTeam,
      contested: state.contested,
      progress: state.progress,
    }));
  }

  public clear(): void {
    for (const ring of this.rings.values()) {
      ring.geometry.dispose();
      ring.removeFromParent();
    }
    for (const material of this.materials.values()) material.dispose();
    for (const material of this.labelMaterials.values()) {
      material.map?.dispose();
      material.dispose();
    }
    this.rings.clear();
    this.materials.clear();
    this.labelMaterials.clear();
    this.states.clear();
    this.positions.clear();
    this.radii.clear();
    this.group.clear();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }

  private getRadius(id: string): number {
    return this.radii.get(id) ?? 4;
  }

  private updateMarker(state: MatchObjectiveState): void {
    const material = this.materials.get(state.id);
    if (!material) return;
    material.color.setHex(state.contested ? 0xffca67 : state.owner === 'player' ? 0x63eaff : state.owner === 'enemy' ? 0xff766d : 0x9eeaf4);
    material.opacity = state.contested ? 1 : state.owner ? 0.95 : 0.7;
  }
}
