import * as THREE from 'three';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { MapDoorDefinition } from '../world/MapDefinition';

export type DoorState = 'closed' | 'opening' | 'open' | 'closing';
export class DoorController {
  public readonly root = new THREE.Group();
  public state: DoorState = 'closed';
  private angle = 0;
  private readonly leaf: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  public constructor(public readonly definition: MapDoorDefinition, private readonly world: CollisionWorld) {
    this.root.name = definition.id;
    this.root.position.set(...definition.hinge);
    this.leaf = new THREE.Mesh(new THREE.BoxGeometry(definition.width, definition.height, 0.18), new THREE.MeshStandardMaterial({ color: definition.color, metalness: 0.6, roughness: 0.5 }));
    this.leaf.position.set(definition.width / 2, definition.height / 2, 0);
    this.root.add(this.leaf);
    this.world.createBoxCollider(definition.id, [definition.width, definition.height, 0.18], this.center(0).toArray() as [number, number, number]);
  }
  public get position(): THREE.Vector3 { return this.center(this.angle); }
  public get prompt(): string | null { return this.state === 'closed' ? `Open ${this.definition.label}` : this.state === 'open' ? `Close ${this.definition.label}` : null; }
  public toggle(actors: readonly THREE.Vector3[]): boolean {
    if (this.state === 'closed') { this.state = 'opening'; return true; }
    if (this.state !== 'open' || actors.some((position) => this.overlaps(position, 0))) return false;
    this.state = 'closing'; return true;
  }
  public openForNpc(): void { if (this.state === 'closed' || this.state === 'closing') this.state = 'opening'; }
  public update(seconds: number, actors: readonly THREE.Vector3[]): void {
    if (this.state !== 'opening' && this.state !== 'closing') return;
    const next = THREE.MathUtils.clamp(this.angle + (this.state === 'opening' ? 1 : -1) * Math.max(seconds, 0) * 1.5, 0, Math.PI / 2);
    // Keep visual and solid transform together. Wait, rather than push/teleport, if occupied.
    if (actors.some((position) => this.overlaps(position, next))) return;
    this.angle = next;
    this.root.rotation.y = next;
    this.world.updateBoxCollider(this.definition.id, this.center(next), next);
    if (next === 0) this.state = 'closed';
    if (next === Math.PI / 2) this.state = 'open';
  }
  public reset(): void { this.angle = 0; this.state = 'closed'; this.root.rotation.y = 0; this.world.updateBoxCollider(this.definition.id, this.center(0), 0); }
  public dispose(): void { this.world.removeBoxCollider(this.definition.id); this.leaf.geometry.dispose(); this.leaf.material.dispose(); this.root.removeFromParent(); }
  private center(angle: number): THREE.Vector3 { return new THREE.Vector3(this.definition.width / 2 * Math.cos(angle), this.definition.height / 2, -this.definition.width / 2 * Math.sin(angle)).add(this.root.position); }
  private overlaps(foot: THREE.Vector3, angle: number): boolean {
    const relative = foot.clone().sub(this.center(angle));
    if (Math.abs(relative.y + 1) > this.definition.height / 2 + 1) return false;
    const x = relative.x * Math.cos(angle) - relative.z * Math.sin(angle);
    const z = relative.x * Math.sin(angle) + relative.z * Math.cos(angle);
    return Math.abs(x) < this.definition.width / 2 + 0.6 && Math.abs(z) < 0.7;
  }
}
