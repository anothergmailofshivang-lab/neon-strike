import * as THREE from 'three';
import type { WeaponController } from './WeaponController';
import type { MapPickupDefinition } from '../world/MapDefinition';
import type { PlayerHealth } from '../player/PlayerHealth';
import type { TacticalEquipmentService } from '../tactical/TacticalEquipmentService';
import type { TacticalEventBus } from '../tactical/TacticalEvents';
import type { CollisionWorld } from '../physics/CollisionWorld';
import { exposed } from '../tactical/ExplosionResolver';

interface AmmoPickupState {
  id: string;
  position: THREE.Vector3;
  amount: number;
  mesh: THREE.Mesh;
  available: boolean;
  respawnRemaining: number;
  respawnSeconds: number;
  type: MapPickupDefinition['type'];
  equipmentId?: string;
}

/** Existing pickup owner, extended to health and equipment; no competing collection loop. */
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
  private readonly healthMaterial = new THREE.MeshStandardMaterial({ color: 0x65e997, emissive: 0x235539, emissiveIntensity: 1 });
  private readonly equipmentMaterial = new THREE.MeshStandardMaterial({ color: 0xffa45b, emissive: 0x5d3310, emissiveIntensity: 1 });

  public constructor(definitions: readonly MapPickupDefinition[] = [], private readonly events: TacticalEventBus | null = null,
    private readonly world?: CollisionWorld, private readonly isActive: () => boolean = () => true) {
    this.group.name = 'AmmoPickups';
    this.setDefinitions(definitions);
  }

  public setDefinitions(definitions: readonly MapPickupDefinition[]): void {
    for (const pickup of this.pickups) pickup.mesh.removeFromParent();
    this.pickups.length = 0;
    const ids = new Set<string>();
    for (const definition of definitions) {
      if (ids.has(definition.id) || !definition.id || !definition.position.every(Number.isFinite) || !Number.isFinite(definition.amount) || definition.amount <= 0 || !Number.isFinite(definition.respawnSeconds) || definition.respawnSeconds < 1) continue;
      ids.add(definition.id); this.createPickup(definition);
    }
    this.simulationTime = 0;
  }

  public update(deltaSeconds: number, playerPosition: THREE.Vector3, weapons: WeaponController, health?: PlayerHealth, equipment?: TacticalEquipmentService): void {
    if (!this.isActive()) return;
    deltaSeconds = Number.isFinite(deltaSeconds) ? Math.min(Math.max(deltaSeconds, 0), 0.25) : 0;
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
      const eyes = playerPosition.clone().add(new THREE.Vector3(0, 1.2, 0));
      if (!health?.isDefeated && pickup.mesh.position.distanceTo(playerPosition) < 1.4 && (!this.world || exposed(this.world, eyes, pickup.mesh.position))) {
        const added = pickup.type === 'ammo'
          ? weapons.collectAmmo(pickup.amount)
          : pickup.type === 'health'
            ? health?.restoreHealth(pickup.amount) ?? 0
            : equipment?.addChargesForEquipment(pickup.equipmentId ?? '', pickup.amount) ?? 0;
        if (added > 0) {
          pickup.available = false;
          pickup.respawnRemaining = pickup.respawnSeconds;
          pickup.mesh.visible = false;
          weapons.playTacticalCue('pickup');
          this.events?.emit({ type: 'pickup-collected', pickupId: pickup.id, pickupType: pickup.type, amount: added });
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

  public getPrompt(position: THREE.Vector3, weapons: WeaponController, health: PlayerHealth, equipment: TacticalEquipmentService): string | null {
    if (!this.isActive() || health.isDefeated) return null;
    const eyes = position.clone().add(new THREE.Vector3(0, 1.2, 0));
    for (const pickup of this.pickups) {
      if (!pickup.available || pickup.position.distanceTo(position) > 2.5 || (this.world && !exposed(this.world, eyes, pickup.position))) continue;
      const useful = pickup.type === 'health' ? health.health < health.maxHealth : pickup.type === 'ammo' ? weapons.canResupply() : equipment.canResupply(pickup.equipmentId ?? '');
      if (useful) return `Approach to collect ${pickup.type === 'equipment' ? pickup.equipmentId?.replaceAll('-', ' ') : pickup.type}`;
    }
    return null;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.healthMaterial.dispose(); this.equipmentMaterial.dispose();
    this.group.clear();
    this.group.removeFromParent();
    this.pickups.length = 0;
  }

  private createPickup(definition: MapPickupDefinition): void {
    const mesh = new THREE.Mesh(this.geometry, definition.type === 'health' ? this.healthMaterial : definition.type === 'equipment' ? this.equipmentMaterial : this.material);
    mesh.position.set(...definition.position);
    mesh.name = `${definition.type}Pickup:${definition.id}`;
    this.group.add(mesh);
    this.pickups.push({
      id: definition.id,
      position: new THREE.Vector3(...definition.position),
      amount: definition.amount,
      mesh,
      available: true,
      respawnRemaining: 0,
      respawnSeconds: definition.respawnSeconds,
      type: definition.type,
      equipmentId: definition.equipmentId,
    });
  }
}
