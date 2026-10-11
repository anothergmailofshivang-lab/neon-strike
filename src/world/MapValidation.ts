import * as THREE from 'three';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { MapDefinition } from './MapDefinition';
import { MapInstance } from './MapInstance';

export interface MapValidationResult {
  mapId: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  reachableNodeCount: number;
  playerSpawnCount: number;
  npcSpawnCount: number;
  coverCount: number;
  pickupCount: number;
}

export function validateMapInstance(definition: MapDefinition, instance: MapInstance): MapValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const [width, depth] = definition.dimensions;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const ids = new Set<string>();

  if (instance.collisionDefinitions.length === 0) {
    errors.push('Map has no collision definitions.');
  }
  for (const collider of instance.collisionDefinitions) {
    if (ids.has(collider.name)) errors.push(`Duplicate collider name: ${collider.name}`);
    ids.add(collider.name);
    if (collider.size.some((value) => !Number.isFinite(value) || value <= 0)) errors.push(`Invalid collider size: ${collider.name}`);
    if (collider.position.some((value) => !Number.isFinite(value))) errors.push(`Invalid collider position: ${collider.name}`);
  }
  const nodeIds = new Set<string>();
  for (const node of instance.navigationGraph.getAllNodes()) {
    if (nodeIds.has(node.id)) errors.push(`Duplicate navigation node: ${node.id}`);
    nodeIds.add(node.id);
    if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y) || !Number.isFinite(node.position.z)) {
      errors.push(`Invalid navigation node position: ${node.id}`);
    }
    if (Math.abs(node.position.x) > halfWidth + 4 || Math.abs(node.position.z) > halfDepth + 4) {
      warnings.push(`Navigation node is outside the documented bounds: ${node.id}`);
    }
    for (const edge of instance.navigationGraph.getNeighbors(node.id)) {
      if (!Number.isFinite(edge.cost) || edge.cost < 0) errors.push(`Invalid navigation edge cost: ${edge.from} -> ${edge.to}`);
      if (!instance.navigationGraph.getNode(edge.to)) errors.push(`Navigation edge points to missing node: ${edge.to}`);
    }
  }
  for (const spawn of [...instance.playerSpawns, ...instance.npcSpawns]) {
    if (Math.abs(spawn.position.x) > halfWidth || Math.abs(spawn.position.z) > halfDepth) {
      errors.push(`Spawn is outside map bounds: ${spawn.id}`);
    }
    if (!Number.isFinite(spawn.position.y) || !Number.isFinite(spawn.yaw)) errors.push(`Spawn has invalid transform: ${spawn.id}`);
  }
  const spawnIds = new Set<string>();
  for (const spawn of [...instance.playerSpawns, ...instance.npcSpawns]) {
    if (spawnIds.has(spawn.id)) errors.push(`Duplicate spawn ID: ${spawn.id}`);
    spawnIds.add(spawn.id);
  }
  const pickupIds = new Set<string>();
  for (const pickup of instance.pickups) {
    if (pickupIds.has(pickup.id)) errors.push(`Duplicate pickup ID: ${pickup.id}`);
    pickupIds.add(pickup.id);
    if (pickup.amount <= 0 || pickup.respawnSeconds < 0) errors.push(`Invalid pickup values: ${pickup.id}`);
  }
  const targetIds = new Set<string>();
  for (const target of instance.trainingTargets) {
    if (targetIds.has(target.id)) errors.push(`Duplicate training target ID: ${target.id}`);
    targetIds.add(target.id);
    if (target.maxHealth <= 0 || target.respawnDelay < 0 || target.position.some((value) => !Number.isFinite(value))) {
      errors.push(`Invalid training target: ${target.id}`);
    }
    if (Math.abs(target.position[0]) > halfWidth || Math.abs(target.position[2]) > halfDepth) {
      errors.push(`Training target is outside map bounds: ${target.id}`);
    }
  }
  const coverIds = new Set<string>();
  for (const point of instance.coverRegistry.getAll()) {
    if (coverIds.has(point.id)) errors.push(`Duplicate cover ID: ${point.id}`);
    coverIds.add(point.id);
    if (!Number.isFinite(point.position.x) || !Number.isFinite(point.position.y) || !Number.isFinite(point.position.z)) errors.push(`Invalid cover position: ${point.id}`);
  }
  if (instance.playerSpawns.length === 0) errors.push('Map has no player spawn.');
  if (instance.npcSpawns.length === 0) errors.push('Map has no NPC spawns.');
  if (instance.navigationGraph.getAllNodes().length === 0) errors.push('Map has no navigation nodes.');

  return {
    mapId: definition.id,
    valid: errors.length === 0,
    errors,
    warnings,
    reachableNodeCount: instance.navigationGraph.getAllNodes().length,
    playerSpawnCount: instance.playerSpawns.length,
    npcSpawnCount: instance.npcSpawns.length,
    coverCount: instance.coverRegistry.getAll().length,
    pickupCount: instance.pickups.length,
  };
}

export function validateMapSpawns(instance: MapInstance, collisionWorld: CollisionWorld): MapValidationResult {
  const result = validateMapInstance(instance.definition, instance);
  const allSpawns = [...instance.playerSpawns, ...instance.npcSpawns];
  for (const spawn of allSpawns) {
    const hit = collisionWorld.raycastStaticWorld(
      { x: spawn.position.x, y: spawn.position.y + 8, z: spawn.position.z },
      { x: 0, y: -1, z: 0 },
      20,
    );
    if (!hit) {
      result.errors.push(`Spawn has no supporting surface: ${spawn.id}`);
      continue;
    }
    if (hit.point.y > spawn.position.y + 0.5 || hit.point.y < spawn.position.y - 1.5) {
      result.warnings.push(`Spawn height differs from nearest supporting surface: ${spawn.id}`);
    }
  }
  result.valid = result.errors.length === 0;
  return result;
}

export function isFiniteVector(vector: THREE.Vector3): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}
