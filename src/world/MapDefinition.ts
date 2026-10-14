import type * as THREE from 'three';
import type { StaticBoxColliderDefinition } from '../physics/CollisionWorld';
import type { NavigationGraph } from '../navigation/NavigationGraph';
import type { CoverRegistry } from './CoverRegistry';
import type { NPCArchetypeDefinition } from '../ai/NPCDefinitions';

export type MapVector3 = readonly [number, number, number];

export interface MapFogDefinition {
  color: number;
  near: number;
  far: number;
}

export interface MapLightingDefinition {
  backgroundColor: number;
  fog?: MapFogDefinition;
}

export interface MapSpawnPoint {
  id: string;
  position: THREE.Vector3;
  yaw: number;
  tags: readonly string[];
  archetype?: NPCArchetypeDefinition['id'];
}

export interface MapPickupDefinition {
  id: string;
  type: 'ammo' | 'health' | 'equipment';
  position: MapVector3;
  amount: number;
  respawnSeconds: number;
  equipmentId?: string;
}

export interface MapInteractionDefinition {
  id: string;
  type: 'switch';
  label: string;
  position: MapVector3;
  radius: number;
  color: number;
  doorId?: string;
}

export interface MapDoorDefinition {
  id: string;
  label: string;
  hinge: MapVector3;
  width: number;
  height: number;
  color: number;
}

export interface MapDestructibleDefinition {
  id: string;
  position: MapVector3;
  size: MapVector3;
  maxHealth: number;
  materialColor: number;
  damageMultiplier?: number;
}

export interface MapTrainingTargetDefinition {
  id: string;
  position: MapVector3;
  maxHealth: number;
  respawnDelay: number;
  accentColor: number;
}

export interface MapControlPointDefinition {
  id: string;
  displayName: string;
  position: MapVector3;
  radius: number;
  tags: readonly string[];
}

export interface MapBuildOutput {
  root: THREE.Group;
  collisionDefinitions: readonly StaticBoxColliderDefinition[];
  navigationGraph: NavigationGraph;
  coverRegistry: CoverRegistry;
  playerSpawns: readonly MapSpawnPoint[];
  npcSpawns: readonly MapSpawnPoint[];
  pickups: readonly MapPickupDefinition[];
  trainingTargets: readonly MapTrainingTargetDefinition[];
  dispose: () => void;
}

export interface MapDefinition {
  id: string;
  displayName: string;
  description: string;
  tacticalTags: readonly string[];
  dimensions: readonly [number, number];
  lighting: MapLightingDefinition;
  controlPoints: readonly MapControlPointDefinition[];
  interactions?: readonly MapInteractionDefinition[];
  destructibles?: readonly MapDestructibleDefinition[];
  doors?: readonly MapDoorDefinition[];
  build: () => MapBuildOutput;
}

export enum MapLifecycleState {
  UNLOADED = 'UNLOADED',
  BUILDING = 'BUILDING',
  REGISTERING_SYSTEMS = 'REGISTERING_SYSTEMS',
  VALIDATING = 'VALIDATING',
  READY = 'READY',
  ACTIVE = 'ACTIVE',
  DEACTIVATING = 'DEACTIVATING',
  DISPOSING = 'DISPOSING',
  FAILED = 'FAILED',
}
