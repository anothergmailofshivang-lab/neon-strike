import type { MapBuildOutput } from '../MapDefinition';
import { GeometryFactory } from '../geometry/GeometryFactory';
import { addGuardrail, addStrip, createMaterialPalette } from '../geometry/MaterialLibrary';
import { addArenaShell, addLightBeacon, addMapLighting, createCover, createGraph, createOutput, spawn } from './MapBuilderUtils';

export function buildNeonYard(): MapBuildOutput {
  const factory = new GeometryFactory('Map:NeonYard');
  const palette = createMaterialPalette(factory, {
    floor: 0x15263b, structure: 0x29445d, secondary: 0x4d6e88, dark: 0x07111a,
    trim: 0x12dff2, warning: 0xff824f, accent: 0x62a8ff,
  });
  addArenaShell(factory, palette, 52, 46, 6);
  factory.grid(52, 26, [0, 0.012, 0], [0x2b5875, 0x1b3047]);

  factory.box({ name: 'CentralTrainingBlock', size: [9, 3, 7], position: [0, 1.5, 0], material: palette.structure });
  factory.box({ name: 'CentralRoof', size: [10, 0.35, 8], position: [0, 3.15, 0], material: palette.dark });
  addStrip(factory, palette.trim, 'CentralCyanTrim', [-4.6, 1.8, -3.55], [8.8, 0.16, 0.18]);
  addStrip(factory, palette.warning, 'CentralOrangeTrim', [4.6, 1.8, 3.55], [8.8, 0.16, 0.18]);

  factory.box({ name: 'WestLowBarrier', size: [8, 1.3, 2], position: [-13, 0.65, -6], material: palette.secondary });
  factory.box({ name: 'EastLowBarrier', size: [7, 1.3, 2], position: [13, 0.65, 5], material: palette.secondary });
  factory.box({ name: 'SouthWestBlock', size: [3, 2.4, 3], position: [-7, 1.2, 11], material: palette.structure });
  factory.box({ name: 'NorthEastBlock', size: [3, 2.4, 3], position: [7, 1.2, -11], material: palette.structure });

  const platform = [ -14, 3.6, 12 ] as [number, number, number];
  factory.box({ name: 'WestTrainingPlatform', size: [9, 0.6, 5], position: platform, material: palette.structure });
  factory.box({ name: 'WestRamp', size: [5.5, 0.8, 9], position: [-14, 1.8, 7], rotation: [0.34, 0, 0], material: palette.dark });
  addGuardrail(factory, palette.secondary, 'WestRailNorth', [-18, 4.5, 12], [0.25, 1.1, 5]);
  addGuardrail(factory, palette.secondary, 'WestRailSouth', [-10, 4.5, 12], [0.25, 1.1, 5]);
  addStrip(factory, palette.accent, 'WestPlatformLight', [-14, 3.95, 9.9], [7, 0.12, 0.2]);

  factory.box({ name: 'EastColumnA', size: [1.4, 4.5, 1.4], position: [19, 2.25, -13], material: palette.secondary });
  factory.box({ name: 'EastColumnB', size: [1.4, 4.5, 1.4], position: [19, 2.25, 13], material: palette.secondary });
  addLightBeacon(factory, palette.trim, 'CyanBeacon', [-21, 3.2, -16]);
  addLightBeacon(factory, palette.warning, 'OrangeBeacon', [21, 3.2, 16]);
  addMapLighting(factory, {
    sky: 0x9ddcff, ground: 0x101827, key: 0xd9f3ff, keyPosition: [-12, 24, 10],
    accents: [[0x00d9ff, [-12, 5, -7], 12, 34], [0xff6b2b, [14, 4, 8], 10, 28]],
  });

  const graph = createGraph([
    ['south', [0, 0, 18], ['spawn', 'lane']], ['west-lane', [-13, 0, 13], ['lane', 'cover']],
    ['east-lane', [13, 0, 13], ['lane', 'cover']], ['west-mid', [-13, 0, 3], ['cover']],
    ['east-mid', [13, 0, 3], ['cover']], ['north-west', [-13, 0, -12], ['flank', 'cover']],
    ['north-east', [13, 0, -12], ['flank', 'cover']], ['north', [0, 0, -18], ['sniper']],
    ['upper-ramp', [-14, 2.2, 8], ['ramp']], ['upper-platform', [-14, 3.9, 12], ['upper', 'cover']],
  ], [
    ['south', 'west-lane'], ['south', 'east-lane'], ['west-lane', 'west-mid'], ['east-lane', 'east-mid'],
    ['west-mid', 'north-west'], ['east-mid', 'north-east'], ['north-west', 'north'], ['north-east', 'north'],
    ['west-mid', 'upper-ramp'], ['upper-ramp', 'upper-platform'],
  ]);
  const cover = createCover([
    ['west-barrier', [-13, 0, -4.7], ['cover']], ['east-barrier', [13, 0, 4.7], ['cover']],
    ['central-west', [-5.5, 0, 0], ['cover']], ['central-east', [5.5, 0, 0], ['cover']],
    ['upper-west', [-14, 3.9, 10], ['cover', 'upper']], ['north-west-cover', [-11, 0, -12], ['cover']],
  ]);
  const players = [spawn('neon-player-south', [0, 0, 18], Math.PI, ['player', 'south'])];
  const npcs = [
    spawn('neon-scout-west', [-16, 0, 15], 0, ['npc', 'south'], 'scout'),
    spawn('neon-rifleman-east', [16, 0, 15], 0, ['npc', 'south'], 'rifleman'),
    spawn('neon-heavy-north', [-16, 0, -14], Math.PI, ['npc', 'north'], 'heavy'),
    spawn('neon-sniper-upper', [-14, 3.9, 12], Math.PI, ['npc', 'upper'], 'sniper'),
  ];
  return createOutput(factory, graph, cover, players, npcs, [
    { id: 'neon-ammo-west', type: 'ammo', position: [-20, 0.9, -3], amount: 30, respawnSeconds: 8 },
    { id: 'neon-ammo-east', type: 'ammo', position: [20, 0.9, 3], amount: 30, respawnSeconds: 8 },
    { id: 'neon-ammo-north', type: 'ammo', position: [0, 0.9, -18], amount: 45, respawnSeconds: 8 },
  ], [
    { id: 'neon-target-west', position: [-21, 0, -14], maxHealth: 100, respawnDelay: 3, accentColor: 0x00e5ff },
    { id: 'neon-target-east', position: [21, 0, -14], maxHealth: 100, respawnDelay: 3, accentColor: 0xff814f },
    { id: 'neon-target-upper', position: [-14, 3.9, 12], maxHealth: 120, respawnDelay: 4, accentColor: 0x6d9cff },
  ]);
}
