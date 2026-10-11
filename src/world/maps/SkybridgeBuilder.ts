import type { MapBuildOutput } from '../MapDefinition';
import { GeometryFactory } from '../geometry/GeometryFactory';
import { addGuardrail, addStrip, createMaterialPalette } from '../geometry/MaterialLibrary';
import { addArenaShell, addLightBeacon, addMapLighting, createCover, createGraph, createOutput, spawn } from './MapBuilderUtils';

export function buildSkybridge(): MapBuildOutput {
  const factory = new GeometryFactory('Map:Skybridge');
  const palette = createMaterialPalette(factory, {
    floor: 0x26384a, structure: 0x74899c, secondary: 0x9fb5c3, dark: 0x0d1926,
    trim: 0x35e8ff, warning: 0xffba5c, accent: 0x8fc8ff,
  });
  addArenaShell(factory, palette, 60, 52, 9);
  factory.grid(60, 30, [0, 0.012, 0], [0x436b83, 0x22384b]);

  factory.box({ name: 'LowerWestBlock', size: [8, 2.4, 7], position: [-17, 1.2, 5], material: palette.structure });
  factory.box({ name: 'LowerEastBlock', size: [8, 2.4, 7], position: [17, 1.2, -5], material: palette.structure });
  factory.box({ name: 'LowerCentralCover', size: [8, 2.8, 4], position: [0, 1.4, 2], material: palette.dark });
  factory.box({ name: 'UpperWestPlatform', size: [12, 0.6, 6], position: [-14, 5.3, -9], material: palette.secondary });
  factory.box({ name: 'UpperEastPlatform', size: [12, 0.6, 6], position: [14, 5.3, 9], material: palette.secondary });
  factory.box({ name: 'SkybridgeWest', size: [12, 0.6, 3.5], position: [-6, 5.3, -9], material: palette.structure });
  factory.box({ name: 'SkybridgeEast', size: [12, 0.6, 3.5], position: [6, 5.3, 9], material: palette.structure });
  addGuardrail(factory, palette.secondary, 'WestBridgeRailNorth', [-6, 6, -10.5], [12, 1.2, 0.2]);
  addGuardrail(factory, palette.secondary, 'WestBridgeRailSouth', [-6, 6, -7.5], [12, 1.2, 0.2]);
  addGuardrail(factory, palette.secondary, 'EastBridgeRailNorth', [6, 6, 7.5], [12, 1.2, 0.2]);
  addGuardrail(factory, palette.secondary, 'EastBridgeRailSouth', [6, 6, 10.5], [12, 1.2, 0.2]);

  factory.box({ name: 'WestSkyRamp', size: [5, 0.8, 12], position: [-21, 2.5, -3], rotation: [0.42, 0, 0], material: palette.dark });
  factory.box({ name: 'EastSkyRamp', size: [5, 0.8, 12], position: [21, 2.5, 3], rotation: [-0.42, 0, 0], material: palette.dark });
  factory.box({ name: 'UpperWestPillar', size: [1.8, 6, 1.8], position: [-20, 3, -12], material: palette.structure });
  factory.box({ name: 'UpperEastPillar', size: [1.8, 6, 1.8], position: [20, 3, 12], material: palette.structure });
  addStrip(factory, palette.trim, 'WestSkylineTrim', [-14, 5.67, -9], [9, 0.12, 0.18]);
  addStrip(factory, palette.warning, 'EastSkylineTrim', [14, 5.67, 9], [9, 0.12, 0.18]);
  addLightBeacon(factory, palette.trim, 'UpperCyanBeacon', [-14, 7.2, -9]);
  addLightBeacon(factory, palette.warning, 'UpperAmberBeacon', [14, 7.2, 9]);
  addMapLighting(factory, {
    sky: 0xb7dcf2, ground: 0x142231, key: 0xe6f5ff, keyPosition: [-20, 28, 14],
    accents: [[0x00d9ff, [-14, 7, -9], 10, 32], [0xffab55, [15, 7, 9], 8, 30]],
  });

  const graph = createGraph([
    ['lower-south', [0, 0, 20], ['spawn', 'lower']], ['lower-west', [-15, 0, 8], ['lower', 'cover']],
    ['lower-east', [15, 0, -8], ['lower', 'cover']], ['lower-center', [0, 0, 7], ['lower', 'cover']],
    ['west-ramp-bottom', [-21, 0, 3], ['ramp']], ['west-ramp-top', [-20, 5.3, -8], ['ramp', 'upper']],
    ['west-platform', [-14, 5.3, -9], ['upper', 'cover']], ['west-bridge', [-6, 5.3, -9], ['bridge']],
    ['east-bridge', [6, 5.3, 9], ['bridge']], ['east-platform', [14, 5.3, 9], ['upper', 'cover']],
    ['east-ramp-top', [20, 5.3, 8], ['ramp', 'upper']], ['east-ramp-bottom', [21, 0, -3], ['ramp']],
  ], [
    ['lower-south', 'lower-west'], ['lower-south', 'lower-east'], ['lower-west', 'lower-center'], ['lower-east', 'lower-center'],
    ['lower-west', 'west-ramp-bottom'], ['west-ramp-bottom', 'west-ramp-top'], ['west-ramp-top', 'west-platform'],
    ['west-platform', 'west-bridge'], ['west-bridge', 'east-bridge'], ['east-bridge', 'east-platform'],
    ['east-platform', 'east-ramp-top'], ['east-ramp-top', 'east-ramp-bottom'], ['east-ramp-bottom', 'lower-east'],
  ]);
  const cover = createCover([
    ['lower-west-cover', [-14, 0, 8], ['cover', 'lower']], ['lower-east-cover', [14, 0, -8], ['cover', 'lower']],
    ['central-cover', [0, 0, 4], ['cover', 'lower']], ['west-platform-cover', [-14, 5.3, -7], ['cover', 'upper']],
    ['east-platform-cover', [14, 5.3, 7], ['cover', 'upper']], ['west-ramp-cover', [-20, 3.4, -4], ['cover', 'ramp']],
  ]);
  const players = [spawn('skybridge-player-lower', [0, 0, 20], Math.PI, ['player', 'lower'])];
  const npcs = [
    spawn('skybridge-scout-west', [-22, 0, 10], 0, ['npc', 'lower'], 'scout'),
    spawn('skybridge-rifleman-east', [22, 0, -10], 0, ['npc', 'lower'], 'rifleman'),
    spawn('skybridge-heavy-platform', [-14, 5.3, -9], 0, ['npc', 'upper'], 'heavy'),
    spawn('skybridge-sniper-platform', [14, 5.3, 9], Math.PI, ['npc', 'upper'], 'sniper'),
  ];
  return createOutput(factory, graph, cover, players, npcs, [
    { id: 'skybridge-ammo-lower', type: 'ammo', position: [-8, 0.9, 6], amount: 30, respawnSeconds: 8 },
    { id: 'skybridge-ammo-west', type: 'ammo', position: [-14, 6.2, -9], amount: 30, respawnSeconds: 8 },
    { id: 'skybridge-ammo-east', type: 'ammo', position: [14, 6.2, 9], amount: 45, respawnSeconds: 8 },
  ], [
    { id: 'skybridge-target-lower', position: [0, 0, -12], maxHealth: 100, respawnDelay: 3, accentColor: 0x54eaff },
    { id: 'skybridge-target-west', position: [-14, 5.3, -9], maxHealth: 120, respawnDelay: 4, accentColor: 0x8fc8ff },
    { id: 'skybridge-target-east', position: [14, 5.3, 9], maxHealth: 100, respawnDelay: 3, accentColor: 0xffbd63 },
  ]);
}
