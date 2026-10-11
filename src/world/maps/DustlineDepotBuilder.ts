import type { MapBuildOutput } from '../MapDefinition';
import { GeometryFactory } from '../geometry/GeometryFactory';
import { addGuardrail, addStrip, createMaterialPalette } from '../geometry/MaterialLibrary';
import { addArenaShell, addLightBeacon, addMapLighting, createCover, createGraph, createOutput, spawn } from './MapBuilderUtils';

export function buildDustlineDepot(): MapBuildOutput {
  const factory = new GeometryFactory('Map:DustlineDepot');
  const palette = createMaterialPalette(factory, {
    floor: 0x5b4635, structure: 0x6e6256, secondary: 0x9a7652, dark: 0x201c1a,
    trim: 0xffaa4e, warning: 0xd95736, accent: 0xf2d08b,
  });
  addArenaShell(factory, palette, 60, 50, 7);
  factory.grid(60, 30, [0, 0.012, 0], [0x8b6348, 0x4f392e]);

  const container = (name: string, position: [number, number, number], color: typeof palette.structure, size: [number, number, number] = [6, 2.8, 2.5], rotation?: [number, number, number]): void => {
    factory.box({ name, size, position, material: color, rotation });
    addStrip(factory, palette.warning, `${name}:marking`, [position[0], position[1] + size[1] / 2 + 0.02, position[2] - size[2] / 2 - 0.01], [size[0] * 0.7, 0.08, 0.12]);
  };
  container('CargoWestA', [-16, 1.4, -9], palette.structure);
  container('CargoWestB', [-16, 1.4, -2], palette.secondary, [6, 2.8, 2.5], [0, 0, 0.04]);
  container('CargoWestC', [-16, 1.4, 5], palette.structure);
  container('CargoEastA', [16, 1.4, 9], palette.secondary);
  container('CargoEastB', [16, 1.4, 2], palette.structure, [6, 2.8, 2.5], [0, 0, -0.04]);
  container('CargoEastC', [16, 1.4, -5], palette.secondary);
  container('CargoNorthStack', [0, 4.2, -16], palette.structure, [8, 2.8, 2.5]);
  factory.box({ name: 'NorthStackBase', size: [8.5, 2.8, 3], position: [0, 1.4, -16], material: palette.dark });

  factory.box({ name: 'LoadingBay', size: [12, 3.6, 7], position: [0, 1.8, 5], material: palette.structure });
  factory.box({ name: 'LoadingBayRoof', size: [13, 0.4, 8], position: [0, 3.8, 5], material: palette.dark });
  factory.box({ name: 'LoadingPlatform', size: [10, 0.6, 5], position: [22, 2.8, -12], material: palette.secondary });
  factory.box({ name: 'LoadingRamp', size: [6, 0.8, 9], position: [22, 1.4, -7], rotation: [0.32, 0, 0], material: palette.dark });
  addGuardrail(factory, palette.warning, 'LoadingRailWest', [17.5, 3.6, -12], [0.2, 1.2, 5]);
  addGuardrail(factory, palette.warning, 'LoadingRailEast', [26.5, 3.6, -12], [0.2, 1.2, 5]);

  factory.box({ name: 'WestServiceWall', size: [3, 3.5, 12], position: [-26, 1.75, 16], material: palette.dark });
  factory.box({ name: 'EastServiceWall', size: [3, 3.5, 12], position: [26, 1.75, -16], material: palette.dark });
  addLightBeacon(factory, palette.warning, 'DepotLampWest', [-24, 3.8, 12]);
  addLightBeacon(factory, palette.accent, 'DepotLampEast', [24, 3.8, -12]);
  addMapLighting(factory, {
    sky: 0xffd0a0, ground: 0x211813, key: 0xffd1a0, keyPosition: [-18, 25, 16],
    accents: [[0xff9c4d, [-18, 4, -7], 9, 34], [0xffc36b, [19, 5, 10], 11, 32]],
  });

  const graph = createGraph([
    ['south', [0, 0, 20], ['spawn', 'lane']], ['west-south', [-11, 0, 15], ['lane', 'cover']],
    ['east-south', [11, 0, 15], ['lane', 'cover']], ['west-mid', [-11, 0, 7], ['cover']],
    ['east-mid', [11, 0, 7], ['cover']], ['loading', [0, 0, 0], ['central', 'cover']],
    ['west-north', [-11, 0, -10], ['flank', 'cover']], ['east-north', [11, 0, -10], ['flank', 'cover']],
    ['north-lane', [0, 0, -21], ['sniper', 'lane']], ['loading-ramp', [22, 1.5, -8], ['ramp']],
    ['loading-platform', [22, 3.2, -12], ['upper', 'cover']],
  ], [
    ['south', 'west-south'], ['south', 'east-south'], ['west-south', 'west-mid'], ['east-south', 'east-mid'],
    ['west-mid', 'loading'], ['east-mid', 'loading'], ['west-mid', 'west-north'], ['east-mid', 'east-north'],
    ['west-north', 'north-lane'], ['east-north', 'north-lane'], ['east-north', 'loading-ramp'], ['loading-ramp', 'loading-platform'],
  ]);
  const cover = createCover([
    ['cargo-west-south', [-12, 0, 15], ['cover']], ['cargo-east-south', [12, 0, 15], ['cover']],
    ['cargo-west-mid', [-12, 0, 5], ['cover']], ['cargo-east-mid', [12, 0, 3], ['cover']],
    ['loading-cover', [0, 0, 1], ['cover']], ['west-flank', [-20, 0, -10], ['cover', 'flank']],
    ['platform-cover', [22, 3.2, -13], ['cover', 'upper']],
  ]);
  const players = [spawn('dustline-player-south', [0, 0, 20], Math.PI, ['player', 'south'])];
  const npcs = [
    spawn('dustline-scout-west', [-23, 0, 17], 0, ['npc', 'west'], 'scout'),
    spawn('dustline-rifleman-east', [23, 0, 17], 0, ['npc', 'east'], 'rifleman'),
    spawn('dustline-heavy-north', [-11, 0, -20], Math.PI, ['npc', 'north'], 'heavy'),
    spawn('dustline-sniper-platform', [22, 3.2, -12], Math.PI, ['npc', 'upper'], 'sniper'),
  ];
  return createOutput(factory, graph, cover, players, npcs, [
    { id: 'dustline-ammo-west', type: 'ammo', position: [-22, 0.9, 2], amount: 30, respawnSeconds: 8 },
    { id: 'dustline-ammo-east', type: 'ammo', position: [22, 0.9, 4], amount: 30, respawnSeconds: 8 },
    { id: 'dustline-ammo-north', type: 'ammo', position: [0, 0.9, -22], amount: 45, respawnSeconds: 8 },
  ], [
    { id: 'dustline-target-west', position: [-23, 0, -18], maxHealth: 100, respawnDelay: 3, accentColor: 0xffb04c },
    { id: 'dustline-target-east', position: [23, 0, -18], maxHealth: 100, respawnDelay: 3, accentColor: 0xd95c3e },
    { id: 'dustline-target-loading', position: [0, 0, 0], maxHealth: 120, respawnDelay: 4, accentColor: 0xffd27b },
  ]);
}
