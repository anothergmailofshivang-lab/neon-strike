import type * as THREE from 'three';

export type EquipmentSlot = 'tactical' | 'utility';
export type EquipmentKind = 'frag' | 'smoke' | 'flash' | 'med-kit' | 'ammo-pack' | 'sensor';

export interface EquipmentDefinition {
  id: string;
  displayName: string;
  description: string;
  slot: EquipmentSlot;
  kind: EquipmentKind;
  startingCharges: number;
  maximumCharges: number;
  cooldownSeconds: number;
  fuseSeconds: number;
  lifetimeSeconds: number;
  radius: number;
  damage: number;
  effectAmount: number;
  effectColor: number;
  bounceDamping: number;
  throwSpeed?: number;
  gravity?: number;
  allowedModes?: readonly string[];
  npcUsable: boolean;
}

export interface EquipmentRuntimeSnapshot {
  equipmentId: string;
  charges: number;
  cooldownRemaining: number;
  ready: boolean;
  useRemaining?: number;
}

export interface EquipmentUseResult {
  accepted: boolean;
  reason?: string;
  snapshot: EquipmentRuntimeSnapshot;
}

export interface ThrowableState {
  id: string;
  ownerId: string;
  equipment: EquipmentDefinition;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  detonated: boolean;
}
