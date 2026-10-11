import type { MapBuildOutput } from '../MapDefinition';
import { GeometryFactory } from '../geometry/GeometryFactory';
import { addGuardrail, createMaterialPalette } from '../geometry/MaterialLibrary';
import { addArenaShell, addLightBeacon, addMapLighting, createCover, createGraph, createOutput, spawn } from './MapBuilderUtils';

export function buildJungleForest(): MapBuildOutput {
  const factory = new GeometryFactory('Map:JungleForest');
  const palette = createMaterialPalette(factory, {
    floor: 0x3c4b32, structure: 0x635b42, secondary: 0x8f7a50, dark: 0x19241b,
    trim: 0x6ce58a, warning: 0xd1a05a, accent: 0x92c96d,
  });
  addArenaShell(factory, palette, 64, 56, 7);
  factory.box({ name: 'ForestFloor', size: [64, 0.16, 56], position: [0, 0.04, 0], material: palette.floor, collision: false });
  factory.grid(64, 32, [0, 0.012, 0], [0x647b4f, 0x34482f]);

  const tree = (id: string, x: number, z: number, scale = 1): void => {
    factory.cylinder({ name: `Tree:${id}:trunk`, radius: 0.32 * scale, height: 3.2 * scale, position: [x, 1.6 * scale, z], material: palette.dark, collision: true });
    factory.sphere({ name: `Tree:${id}:canopy`, radius: 1.8 * scale, position: [x, 3.8 * scale, z], material: palette.accent, scale: [1.25, 0.9, 1.15], collision: false });
    factory.sphere({ name: `Tree:${id}:canopy2`, radius: 1.2 * scale, position: [x + 0.45 * scale, 4.5 * scale, z + 0.2 * scale], material: palette.secondary, scale: [1.1, 0.8, 1], collision: false });
  };
  for (const [id, x, z, s] of [['a', -24, -17, 1.1], ['b', -19, -4, 0.85], ['c', -25, 13, 1.3], ['d', -11, -18, 0.9], ['e', 18, -17, 1.2], ['f', 24, -4, 0.9], ['g', 21, 15, 1.25], ['h', 9, 19, 0.85], ['i', -5, 15, 1.1]] as Array<[string, number, number, number]>) tree(id, x, z, s);
  const rock = (id: string, position: [number, number, number], size: [number, number, number]): void => {
    factory.box({ name: `Rock:${id}`, size, position, rotation: [0.06, 0.2, -0.08], material: palette.secondary });
  };
  rock('west-ridge', [-19, 1.1, 8], [4, 2.2, 3]); rock('east-ridge', [19, 0.9, -7], [3.5, 1.8, 3]); rock('clearing-rock', [3, 0.75, 3], [2.8, 1.5, 2]);
  factory.box({ name: 'ForestClearing', size: [18, 0.06, 14], position: [0, 0.05, 4], material: palette.secondary, collision: false });

  // Cabin/outpost with doorway gap and compact interior.
  factory.box({ name: 'CabinFloor', size: [8, 0.2, 7], position: [-10, 0.1, -3], material: palette.floor });
  factory.box({ name: 'CabinNorthWall', size: [8, 3, 0.25], position: [-10, 1.5, -6.4], material: palette.structure });
  factory.box({ name: 'CabinSouthLeft', size: [3, 3, 0.25], position: [-12.5, 1.5, 0.4], material: palette.structure });
  factory.box({ name: 'CabinSouthRight', size: [3, 3, 0.25], position: [-7.5, 1.5, 0.4], material: palette.structure });
  factory.box({ name: 'CabinWestWall', size: [0.25, 3, 7], position: [-13.9, 1.5, -3], material: palette.structure });
  factory.box({ name: 'CabinEastWall', size: [0.25, 3, 7], position: [-6.1, 1.5, -3], material: palette.structure });
  factory.box({ name: 'CabinTable', size: [1.8, 0.65, 0.9], position: [-10, 0.45, -2.5], material: palette.dark });
  factory.box({ name: 'CabinCrate', size: [0.9, 0.9, 0.9], position: [-8, 0.45, -4.7], material: palette.warning });

  // Stream crossing and outpost.
  factory.box({ name: 'StreamBed', size: [10, 0.03, 4], position: [17, 0.04, 3], material: palette.trim, collision: false });
  factory.box({ name: 'WoodenBridge', size: [5, 0.35, 4.8], position: [17, 0.3, 3], material: palette.warning });
  addGuardrail(factory, palette.dark, 'BridgeRailWest', [14.8, 0.95, 3], [0.18, 1.1, 4.6]);
  addGuardrail(factory, palette.dark, 'BridgeRailEast', [19.2, 0.95, 3], [0.18, 1.1, 4.6]);
  factory.box({ name: 'OutpostWall', size: [7, 1.4, 0.3], position: [10, 0.7, 15], material: palette.secondary });
  factory.box({ name: 'OutpostCrates', size: [2.2, 1.4, 2.2], position: [15, 0.7, 15], material: palette.warning });
  addLightBeacon(factory, palette.warning, 'CampLantern', [-10, 2.7, -3]);
  addMapLighting(factory, {
    sky: 0xbdd69d, ground: 0x152316, key: 0xf1e0a5, keyPosition: [-18, 30, 10],
    accents: [[0x74d987, [-11, 3, -3], 5, 16], [0xb7e86d, [17, 3, 3], 4, 14]],
  });

  const graph = createGraph([
    ['south', [0, 0, 22], ['spawn', 'trail']], ['west-trail', [-17, 0, 16], ['trail', 'cover']], ['east-trail', [17, 0, 16], ['trail', 'cover']],
    ['clearing', [0, 0, 4], ['central', 'open']], ['west-ridge', [-19, 0, 8], ['cover', 'ridge']], ['east-ridge', [19, 0, -7], ['cover', 'ridge']],
    ['cabin', [-10, 0, -3], ['interior', 'cover']], ['north-trail', [0, 0, -21], ['trail', 'sniper']], ['bridge-west', [12, 0, 3], ['bridge']], ['bridge-east', [22, 0, 3], ['bridge', 'cover']],
  ], [['south', 'west-trail'], ['south', 'east-trail'], ['west-trail', 'clearing'], ['east-trail', 'clearing'], ['clearing', 'west-ridge'], ['clearing', 'east-ridge'], ['clearing', 'cabin'], ['clearing', 'north-trail'], ['east-trail', 'bridge-west'], ['bridge-west', 'bridge-east']]);
  const cover = createCover([
    ['west-rock', [-19, 0, 8], ['cover']], ['east-rock', [19, 0, -7], ['cover']], ['cabin-table', [-10, 0, -2.5], ['cover', 'interior']], ['bridge-rail', [14.5, 0, 3], ['cover']], ['outpost-wall', [10, 0, 14], ['cover']], ['clearing-rock', [3, 0, 3], ['cover']],
  ]);
  return createOutput(factory, graph, cover,
    [spawn('forest-player-clearing', [0, 0, 22], Math.PI, ['player', 'clearing'])],
    [spawn('forest-scout-west', [-17, 0, 16], 0, ['npc', 'west'], 'scout'), spawn('forest-rifleman-east', [17, 0, 16], 0, ['npc', 'east'], 'rifleman'), spawn('forest-heavy-north', [-4, 0, -21], Math.PI, ['npc', 'north'], 'heavy'), spawn('forest-sniper-ridge', [19, 0, -7], Math.PI, ['npc', 'ridge'], 'sniper')],
    [{ id: 'forest-ammo-cabin', type: 'ammo', position: [-10, 0.9, -3], amount: 30, respawnSeconds: 8 }, { id: 'forest-ammo-bridge', type: 'ammo', position: [17, 0.9, 3], amount: 30, respawnSeconds: 8 }, { id: 'forest-ammo-outpost', type: 'ammo', position: [12, 0.9, 15], amount: 45, respawnSeconds: 8 }],
    [{ id: 'forest-target-clearing', position: [0, 0, 4], maxHealth: 100, respawnDelay: 3, accentColor: 0x6ce58a }, { id: 'forest-target-cabin', position: [-10, 0, -3], maxHealth: 120, respawnDelay: 4, accentColor: 0xffc15b }, { id: 'forest-target-ridge', position: [19, 0, -7], maxHealth: 100, respawnDelay: 3, accentColor: 0x9fe87c }],
  );
}
