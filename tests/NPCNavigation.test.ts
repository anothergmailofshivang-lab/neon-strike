import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AStarPathfinder } from '../src/navigation/AStarPathfinder';
import { createPracticeNavigationGraph } from '../src/navigation/NavigationGraph';
import { NPCNavigation } from '../src/ai/NPCNavigation';

describe('NPC navigation', () => {
  it('finds a connected route across the practice graph', () => {
    const graph = createPracticeNavigationGraph();
    const path = new AStarPathfinder().findPath(graph, 'south-center', 'north-center');

    expect(path).not.toBeNull();
    expect(path?.nodeIds[0]).toBe('south-center');
    expect(path?.nodeIds.at(-1)).toBe('north-center');
    expect(path?.nodeIds.length).toBeGreaterThan(2);
  });

  it('advances waypoints instead of repeatedly querying the same goal', () => {
    const graph = createPracticeNavigationGraph();
    const navigation = new NPCNavigation(graph);
    const start = new THREE.Vector3(0, 0, 14);
    const goal = new THREE.Vector3(0, 0, -16);

    expect(navigation.requestPath(start, goal)).toBe(true);
    const firstWaypoint = navigation.getNextWaypoint(start);
    expect(firstWaypoint).not.toBeNull();
    const queries = navigation.pathQueries;

    expect(navigation.requestPath(start, goal)).toBe(true);
    expect(navigation.pathQueries).toBe(queries);
    expect(navigation.route.length).toBeGreaterThan(1);
  });
});
