import * as THREE from 'three';
import type { WeaponController } from './WeaponController';
import type { MapPickupDefinition } from '../world/MapDefinition';

interface AmmoPickupState {
  id: string;
  position: THREE.Vector3;
  amount: number;
  mesh: THREE.Mesh;
  available: boolean;
  respawnRemaining: number;
  respawnSeconds: number;
}

export class AmmoPickupSystem {
  public readonly group = new THREE.Group();
  private readonly pickups: AmmoPickupState[] = [];
  private readonly geometry = new THREE.OctahedronGeometry(0.28, 0);
  private readonly material = new THREE.MeshStandardMaterial({
    color: 0x71f4ff,
    emissive: 0x00b8d4,
    emissiveIntensity: 2,
    metalness: 0.2,
    roughness: 0.25,
  });
  private simulationTime = 0;

  public constructor(definitions: readonly MapPickupDefinition[] = []) {
    this.group.name = 'AmmoPickups';
    this.setDefinitions(definitions);
  }

  public setDefinitions(definitions: readonly MapPickupDefinition[]): void {
    for (const pickup of this.pickups) pickup.mesh.removeFromParent();
    this.pickups.length = 0;
    for (const definition of definitions) this.createPickup(definition);
    this.simulationTime = 0;
  }

  public update(deltaSeconds: number, playerPosition: THREE.Vector3, weapons: WeaponController): void {
    this.simulationTime += Math.max(deltaSeconds, 0);
    for (const pickup of this.pickups) {
      if (!pickup.available) {
        pickup.respawnRemaining = Math.max(pickup.respawnRemaining - deltaSeconds, 0);
        if (pickup.respawnRemaining === 0) {
          pickup.available = true;
          pickup.mesh.visible = true;
        }
        continue;
      }
      pickup.mesh.rotation.y += deltaSeconds * 1.5;
      pickup.mesh.position.y = pickup.position.y + Math.sin(this.simulationTime * 3 + pickup.position.x) * 0.08;
      if (pickup.mesh.position.distanceTo(playerPosition) < 1.4) {
        const added = weapons.collectAmmo(pickup.amount);
        if (added > 0) {
          pickup.available = false;
          pickup.respawnRemaining = pickup.respawnSeconds;
          pickup.mesh.visible = false;
        }
      }
    }
  }

  public reset(): void {
    this.simulationTime = 0;
    for (const pickup of this.pickups) {
      pickup.available = true;
      pickup.respawnRemaining = 0;
      pickup.mesh.visible = true;
      pickup.mesh.position.copy(pickup.position);
    }
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.group.clear();
    this.pickups.length = 0;
  }

  private createPickup(definition: MapPickupDefinition): void {
    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.position.set(...definition.position);
    mesh.name = `AmmoPickup:${definition.id}`;
    this.group.add(mesh);
    this.pickups.push({
      id: definition.id,
      position: new THREE.Vector3(...definition.position),
      amount: definition.amount,
      mesh,
      available: true,
      respawnRemaining: 0,
      respawnSeconds: definition.respawnSeconds,
    });
  }
}
