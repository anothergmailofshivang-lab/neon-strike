import * as THREE from 'three';
import type { CollisionWorld } from '../physics/CollisionWorld';
import { NavigationGraph } from '../navigation/NavigationGraph';
import { groundPoint, isWalkableSegment } from '../navigation/WalkableNavigation';
import type { MapInstance } from '../world/MapInstance';
import type { MissionDefinition } from './CampaignTypes';

export interface MissionWorldLayout { graph: NavigationGraph; spawn: THREE.Vector3; yaw: number; points: ReadonlyMap<string, THREE.Vector3>; }

/** Mission-only ground navigation. Every edge is checked; no route is inferred through a wall. */
export function resolveMissionWorld(definition: MissionDefinition, map: MapInstance, world: CollisionWorld): MissionWorldLayout {
  if (map.definition.id !== definition.mapId) throw new Error('Mission map mismatch');
  const start = map.playerSpawns.find((spawn) => spawn.id === definition.spawnId);
  if (!start) throw new Error(`Missing mission spawn: ${definition.spawnId}`);
  const graph = new NavigationGraph(), [width, depth] = map.definition.dimensions;
  const cells = new Map<string, THREE.Vector3>();
  for (let x = -width / 2 + 2; x <= width / 2 - 2; x += 2) for (let z = -depth / 2 + 2; z <= depth / 2 - 2; z += 2) {
    const position = groundPoint(world, x, z); if (!position) continue;
    const id = `mission-grid:${x}:${z}`; cells.set(id, position); graph.addNode({ id, position, tags: ['mission-ground'] });
  }
  for (const [id, position] of cells) for (const [dx, dz] of [[2, 0], [0, 2], [2, 2], [-2, 2]]) {
    const next = `mission-grid:${position.x + dx}:${position.z + dz}`, point = cells.get(next);
    if (point && isWalkableSegment(world, position, point)) graph.addBidirectionalEdge(id, next);
  }
  const points = new Map<string, THREE.Vector3>();
  const attach = (id: string, tuple: readonly number[]): THREE.Vector3 => {
    if (Math.abs(tuple[0]) >= width / 2 - 1 || Math.abs(tuple[2]) >= depth / 2 - 1) throw new Error(`Mission point outside bounds: ${id}`);
    const position = groundPoint(world, tuple[0], tuple[2]);
    if (!position || Math.abs(position.y - tuple[1]) > 0.5) throw new Error(`Unsupported or obstructed mission point: ${id}`);
    const connections = [...cells].filter(([, p]) => p.distanceTo(position) <= 3).filter(([, p]) => isWalkableSegment(world, position, p));
    if (!connections.length) throw new Error(`Mission point has no walkable approach: ${id}`);
    graph.addNode({ id, position, tags: ['mission-point'] });
    for (const [neighbor] of connections) graph.addBidirectionalEdge(id, neighbor);
    points.set(id, position); return position;
  };
  const spawn = attach('mission-start', start.position.toArray());
  for (const objective of definition.objectives) if (objective.position) attach(`objective:${objective.id}`, objective.position);
  for (const object of definition.objects) {
    if (!world.isSphereClear(new THREE.Vector3(...object.position), 0.3)) throw new Error(`Mission object embedded in geometry: ${object.id}`);
    attach(`object:${object.id}`, [object.position[0], object.position[1] - 1, object.position[2]]);
  }
  for (const checkpoint of definition.checkpoints) attach(`checkpoint:${checkpoint.id}`, checkpoint.position);
  const spawns = new Set(definition.encounters.flatMap((encounter) => encounter.units.map((unit) => unit.spawnId)));
  for (const id of spawns) {
    const point = map.npcSpawns.find((p) => p.id === id);
    if (!point) throw new Error(`Missing encounter spawn: ${id}`);
    const resolved = attach(`spawn:${id}`, point.position.toArray());
    if (resolved.distanceTo(spawn) < 6) throw new Error(`Encounter spawn too close to deployment: ${id}`);
  }
  for (const encounter of definition.encounters) attach(`encounter:${encounter.id}`, encounter.destination);
  const reachable = new Set(['mission-start']), queue = ['mission-start'];
  for (let i = 0; i < queue.length; i++) for (const edge of graph.getNeighbors(queue[i])) if (!reachable.has(edge.to)) { reachable.add(edge.to); queue.push(edge.to); }
  for (const id of points.keys()) if (!reachable.has(id)) throw new Error(`Mission point unreachable from deployment: ${id}`);
  // Filter disconnected grid islands so NPC nearest-node requests cannot select them.
  const connected = new NavigationGraph();
  for (const node of graph.getAllNodes()) if (reachable.has(node.id)) connected.addNode(node);
  for (const node of connected.getAllNodes()) for (const edge of graph.getNeighbors(node.id)) if (node.id < edge.to && reachable.has(edge.to)) connected.addBidirectionalEdge(node.id, edge.to, edge.cost);
  return { graph: connected, spawn, yaw: 0, points };
}
