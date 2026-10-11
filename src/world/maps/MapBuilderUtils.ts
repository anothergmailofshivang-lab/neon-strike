import * as THREE from 'three';
import { NavigationGraph } from '../../navigation/NavigationGraph';
import { CoverRegistry } from '../CoverRegistry';
import type { MapBuildOutput, MapPickupDefinition, MapSpawnPoint, MapTrainingTargetDefinition } from '../MapDefinition';
import { GeometryFactory } from '../geometry/GeometryFactory';
import type { MaterialPalette } from '../geometry/MaterialLibrary';

export function addArenaShell(factory: GeometryFactory, palette: MaterialPalette, width: number, depth: number, boundaryHeight = 6): void {
  factory.box({ name: 'PlayableFloor', size: [width, 0.2, depth], position: [0, -0.1, 0], material: palette.floor });
  factory.box({ name: 'NorthBoundary', size: [width, boundaryHeight, 1], position: [0, boundaryHeight / 2, -depth / 2], material: palette.dark });
  factory.box({ name: 'SouthBoundary', size: [width, boundaryHeight, 1], position: [0, boundaryHeight / 2, depth / 2], material: palette.dark });
  factory.box({ name: 'WestBoundary', size: [1, boundaryHeight, depth], position: [-width / 2, boundaryHeight / 2, 0], material: palette.dark });
  factory.box({ name: 'EastBoundary', size: [1, boundaryHeight, depth], position: [width / 2, boundaryHeight / 2, 0], material: palette.dark });
}

export function addMapLighting(factory: GeometryFactory, colors: { sky: number; ground: number; key: number; keyPosition: [number, number, number]; accents: Array<[number, [number, number, number], number, number]> }): void {
  factory.addLight(new THREE.HemisphereLight(colors.sky, colors.ground, 1.8));
  const key = new THREE.DirectionalLight(colors.key, 2.5);
  key.position.set(...colors.keyPosition);
  factory.addLight(key);
  for (const [color, position, intensity, distance] of colors.accents) {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(...position);
    factory.addLight(light);
  }
}

export function addLightBeacon(factory: GeometryFactory, material: THREE.Material, name: string, position: readonly [number, number, number]): void {
  factory.box({ name, size: [0.18, 2.4, 0.18], position, material, collision: false });
}

export function createGraph(nodes: Array<[string, [number, number, number], string[]]>, edges: Array<[string, string]>): NavigationGraph {
  const graph = new NavigationGraph();
  for (const [id, position, tags] of nodes) graph.addNode({ id, position: new THREE.Vector3(...position), tags });
  for (const [from, to] of edges) graph.addBidirectionalEdge(from, to);
  return graph;
}

export function createCover(points: Array<[string, [number, number, number], string[]]>): CoverRegistry {
  const registry = new CoverRegistry();
  for (const [id, position, tags] of points) registry.register({ id, position: new THREE.Vector3(...position), tags });
  return registry;
}

export function spawn(id: string, position: [number, number, number], yaw: number, tags: string[], archetype?: MapSpawnPoint['archetype']): MapSpawnPoint {
  return { id, position: new THREE.Vector3(...position), yaw, tags, archetype };
}

export function createOutput(
  factory: GeometryFactory,
  navigationGraph: NavigationGraph,
  coverRegistry: CoverRegistry,
  playerSpawns: readonly MapSpawnPoint[],
  npcSpawns: readonly MapSpawnPoint[],
  pickups: readonly MapPickupDefinition[],
  trainingTargets: readonly MapTrainingTargetDefinition[] = [],
): MapBuildOutput {
  return {
    root: factory.root,
    collisionDefinitions: factory.collisionDefinitions,
    navigationGraph,
    coverRegistry,
    playerSpawns,
    npcSpawns,
    pickups,
    trainingTargets,
    dispose: () => factory.dispose(),
  };
}
