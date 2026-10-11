import * as THREE from 'three';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { MapInstance } from '../world/MapInstance';
import { NavigationGraph } from './NavigationGraph';

/** Authored routes are retained, while objective approach nodes are attached only
 * after a real collider/floor clearance check. Built once per map load. */
export function buildWalkableNavigation(map: MapInstance, collision: CollisionWorld): NavigationGraph {
  const graph = new NavigationGraph();
  for (const node of map.navigationGraph.getAllNodes()) graph.addNode(node);
  for (const node of map.navigationGraph.getAllNodes()) {
    for (const edge of map.navigationGraph.getNeighbors(node.id)) {
      if (node.id < edge.to) graph.addBidirectionalEdge(node.id, edge.to, edge.cost);
    }
  }
  // The authored graph remains authoritative for ramps and elevated routes. Add
  // only validated objective approach nodes here; this keeps map loading bounded
  // while ensuring mode objectives have a real navigation attachment.
  for (const objective of map.controlPoints) {
    const point = groundPoint(collision, objective.position[0], objective.position[2]);
    if (!point) continue;
    const id = `objective:${objective.id}`;
    if (graph.getNode(id)) continue;
    const nearest = graph.getAllNodes()
      .filter((node) => node.id !== id)
      .sort((a, b) => a.position.distanceToSquared(point) - b.position.distanceToSquared(point))[0];
    if (nearest && nearest.position.distanceTo(point) < 12 && isWalkableSegment(collision, nearest.position, point)) {
      graph.addNode({ id, position: point, tags: [...objective.tags, 'objective'] });
      graph.addBidirectionalEdge(id, nearest.id);
    }
  }
  return graph;
}

export function groundPoint(collision: CollisionWorld, x: number, z: number): THREE.Vector3 | null {
  const floor = collision.raycastStaticWorld({ x, y: 0.55, z }, { x: 0, y: -1, z: 0 }, 0.8);
  if (!floor || floor.normal.y < 0.85 || floor.point.y > 0.3) return null;
  const point = new THREE.Vector3(x, floor.point.y + 0.04, z);
  return collision.isCapsuleClear(point) ? point : null;
}

export function isWalkableSegment(collision: CollisionWorld, from: THREE.Vector3, to: THREE.Vector3): boolean {
  const steps = Math.ceil(from.distanceTo(to) / 0.4);
  for (let i = 0; i <= steps; i++) {
    const point = from.clone().lerp(to, steps ? i / steps : 0);
    if (!groundPoint(collision, point.x, point.z)) return false;
  }
  return true;
}
