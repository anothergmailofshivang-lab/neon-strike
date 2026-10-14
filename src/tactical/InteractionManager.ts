import * as THREE from 'three';
import type { MapInteractionDefinition, MapDoorDefinition } from '../world/MapDefinition';
import type { CollisionWorld } from '../physics/CollisionWorld';
import { exposed } from './ExplosionResolver';
import { DoorController } from './DoorController';

interface SwitchState { definition: MapInteractionDefinition; mesh: THREE.Mesh; light: THREE.PointLight; active: boolean; }
export interface ContextInteraction { id: string; position: THREE.Vector3; radius: number; label: () => string | null; activate: () => boolean; }
export class InteractionManager {
  public readonly group = new THREE.Group();
  private readonly switches = new Map<string, SwitchState>();
  private readonly doors = new Map<string, DoorController>();
  private readonly geometry = new THREE.BoxGeometry(0.35, 0.65, 0.12);
  private actors: readonly THREE.Vector3[] = [];
  private readonly targets = new Map<string, ContextInteraction>();
  public constructor(scene: THREE.Scene, private readonly world: CollisionWorld, private readonly isActive: () => boolean, private readonly sound: () => void = () => {}, private readonly canInteract: () => boolean = isActive) {
    this.group.name = 'MapInteractions'; scene.add(this.group);
  }
  public setDefinitions(definitions: readonly MapInteractionDefinition[], doors: readonly MapDoorDefinition[] = []): void {
    this.clear();
    for (const definition of doors) { const door = new DoorController(definition, this.world); this.doors.set(definition.id, door); this.group.add(door.root); }
    for (const definition of definitions) {
      if (definition.doorId && !this.doors.has(definition.doorId)) { console.warn(`[NEON STRIKE] Missing door for ${definition.id}`); continue; }
      const mesh = new THREE.Mesh(this.geometry, new THREE.MeshStandardMaterial({ color: definition.color, emissive: definition.color, emissiveIntensity: 0.3 }));
      mesh.position.set(...definition.position);
      const light = new THREE.PointLight(definition.color, 0, 9);
      light.position.copy(mesh.position).add(new THREE.Vector3(0, 0.8, 0));
      this.group.add(mesh, light);
      this.switches.set(definition.id, { definition, mesh, light, active: false });
    }
  }
  public update(seconds: number, actors: readonly THREE.Vector3[], npcPositions: readonly THREE.Vector3[]): void {
    if (!this.isActive()) return;
    this.actors = actors;
    for (const door of this.doors.values()) {
      if (npcPositions.some((position) => position.distanceTo(door.position) < 4)) door.openForNpc();
      door.update(seconds, actors);
    }
  }
  public registerTarget(target: ContextInteraction): () => void {
    if (this.targets.has(target.id)) throw new Error(`Duplicate interaction: ${target.id}`);
    this.targets.set(target.id, target);
    return () => { if (this.targets.get(target.id) === target) this.targets.delete(target.id); };
  }
  public openDoor(id: string): boolean { const door = this.doors.get(id); if (!door) return false; door.openForNpc(); return true; }
  public getPrompt(origin: THREE.Vector3, forward: THREE.Vector3): string | null { return this.detect(origin, forward)?.label ?? null; }
  public interact(origin: THREE.Vector3, forward: THREE.Vector3): string | null {
    if (!this.isActive() || !this.canInteract()) return null;
    const target = this.detect(origin, forward);
    if (!target) return null;
    const result = target.activate();
    if (result) this.sound();
    return result ? target.label.replace(' [E]', '') : 'Door passage occupied';
  }
  public reset(): void { for (const door of this.doors.values()) door.reset(); for (const state of this.switches.values()) this.setSwitch(state, false); }
  public clear(): void {
    for (const door of this.doors.values()) door.dispose();
    for (const state of this.switches.values()) (state.mesh.material as THREE.Material).dispose();
    this.doors.clear(); this.switches.clear(); this.targets.clear(); this.actors = []; this.group.clear();
  }
  public dispose(): void { this.clear(); this.geometry.dispose(); this.group.removeFromParent(); }
  private detect(origin: THREE.Vector3, forward: THREE.Vector3): { label: string; activate: () => boolean } | null {
    if (!this.isActive() || !this.canInteract()) return null;
    let best: { label: string; activate: () => boolean } | null = null, nearest = Infinity;
    const consider = (position: THREE.Vector3, range: number, label: string | null, activate: () => boolean, colliderId?: string): void => {
      const offset = position.clone().sub(origin), distance = offset.length();
      if (!label || distance > range || distance >= nearest || forward.dot(offset.normalize()) < 0.65 || !exposed(this.world, origin, position, colliderId)) return;
      nearest = distance; best = { label: `${label} [E]`, activate };
    };
    for (const door of this.doors.values()) consider(door.position, 3, door.prompt, () => door.toggle(this.actors), door.definition.id);
    for (const state of this.switches.values()) {
      const door = state.definition.doorId ? this.doors.get(state.definition.doorId) : undefined;
      consider(state.mesh.position, state.definition.radius, door ? door.prompt : `${state.active ? 'Disable' : 'Enable'} ${state.definition.label}`, () => {
        if (door) return door.toggle(this.actors);
        this.setSwitch(state, !state.active); return true;
      });
    }
    for (const target of this.targets.values()) consider(target.position, target.radius, target.label(), target.activate);
    return best;
  }
  private setSwitch(state: SwitchState, active: boolean): void { state.active = active; state.light.intensity = active ? 12 : 0; (state.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = active ? 2 : 0.3; }
}
