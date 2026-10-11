import type { MapBuildOutput } from '../MapDefinition';
import { GeometryFactory } from '../geometry/GeometryFactory';
import { addGuardrail, addStrip, createMaterialPalette } from '../geometry/MaterialLibrary';
import { addArenaShell, addLightBeacon, addMapLighting, createCover, createGraph, createOutput, spawn } from './MapBuilderUtils';

export function buildFantasyRuins(): MapBuildOutput {
  const factory = new GeometryFactory('Map:FantasyRuins');
  const palette = createMaterialPalette(factory, {
    floor: 0x5b513f, structure: 0x746a59, secondary: 0x9a8b6d, dark: 0x241f1a,
    trim: 0x69d7c4, warning: 0xd3914d, accent: 0xb5e0a0,
  });
  addArenaShell(factory, palette, 64, 56, 8);
  factory.box({ name: 'KingdomGround', size: [64, 0.18, 56], position: [0, 0.04, 0], material: palette.floor, collision: false });
  factory.grid(64, 32, [0, 0.012, 0], [0x8b7d60, 0x493f32]);

  const tower = (name: string, x: number, z: number): void => {
    factory.cylinder({ name: `${name}:stone`, radius: 2.4, height: 6.5, position: [x, 3.25, z], material: palette.structure, collision: true });
    factory.cylinder({ name: `${name}:cap`, radius: 2.7, height: 0.35, position: [x, 6.55, z], material: palette.secondary, collision: false });
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) addLightBeacon(factory, palette.warning, `${name}:torch:${angle}`, [x + Math.cos(angle) * 1.9, 3.4, z + Math.sin(angle) * 1.9]);
  };
  tower('KeepWest', -20, -13); tower('KeepEast', 20, -13);
  factory.box({ name: 'CastleWallNorth', size: [34, 5, 1.2], position: [0, 2.5, -16], material: palette.structure });
  factory.box({ name: 'CastleGateLeft', size: [11, 5, 1.2], position: [-11.5, 2.5, -16], material: palette.structure });
  factory.box({ name: 'CastleGateRight', size: [11, 5, 1.2], position: [11.5, 2.5, -16], material: palette.structure });
  factory.box({ name: 'CastleGateArch', size: [3, 2.2, 1.2], position: [0, 4, -16], material: palette.secondary });

  // Village lane with timber houses and an accessible interior.
  const house = (name: string, x: number, z: number, material: typeof palette.structure): void => {
    factory.box({ name: `${name}:floor`, size: [7, 0.2, 6], position: [x, 0.1, z], material: palette.floor });
    factory.box({ name: `${name}:north`, size: [7, 2.8, 0.25], position: [x, 1.4, z - 3], material });
    factory.box({ name: `${name}:west`, size: [0.25, 2.8, 6], position: [x - 3.5, 1.4, z], material });
    factory.box({ name: `${name}:east`, size: [0.25, 2.8, 6], position: [x + 3.5, 1.4, z], material });
    factory.box({ name: `${name}:south-left`, size: [2.4, 2.8, 0.25], position: [x - 2.3, 1.4, z + 3], material });
    factory.box({ name: `${name}:south-right`, size: [2.4, 2.8, 0.25], position: [x + 2.3, 1.4, z + 3], material });
    factory.box({ name: `${name}:roof`, size: [7.5, 0.3, 6.5], position: [x, 3, z], material: palette.dark });
    factory.box({ name: `${name}:table`, size: [1.5, 0.7, 0.8], position: [x, 0.45, z], material: palette.secondary });
  };
  house('VillageHouseWest', -17, 10, palette.secondary);
  house('VillageHouseEast', 17, 10, palette.structure);
  factory.box({ name: 'MarketSquare', size: [18, 0.06, 10], position: [0, 0.04, 9], material: palette.secondary, collision: false });
  factory.box({ name: 'MarketStallWest', size: [3.6, 2.2, 1.3], position: [-5, 1.1, 9], material: palette.warning });
  factory.box({ name: 'MarketStallEast', size: [3.6, 2.2, 1.3], position: [5, 1.1, 9], material: palette.warning });
  factory.box({ name: 'MarketCrates', size: [1.5, 1, 1.5], position: [0, 0.5, 13], material: palette.dark });

  // Ruined wall, bridge, forest edge, and magical landmark.
  factory.box({ name: 'RuinedWall', size: [16, 2.6, 1], position: [-1, 1.3, -2], rotation: [0, 0, -0.05], material: palette.structure });
  factory.box({ name: 'BrokenPillar', size: [1.5, 3.8, 1.5], position: [-10, 1.9, -2], material: palette.secondary });
  factory.box({ name: 'StoneBridge', size: [7, 0.5, 8], position: [22, 0.35, 1], material: palette.secondary });
  addGuardrail(factory, palette.dark, 'BridgeRailWest', [18.5, 1.1, 1], [0.2, 1.1, 7]);
  addGuardrail(factory, palette.dark, 'BridgeRailEast', [25.5, 1.1, 1], [0.2, 1.1, 7]);
  for (const [id, x, z] of [['oak-a', -27, 10], ['oak-b', -25, -3], ['oak-c', 26, -12]] as Array<[string, number, number]>) {
    factory.cylinder({ name: `Oak:${id}:trunk`, radius: 0.35, height: 3.2, position: [x, 1.6, z], material: palette.dark, collision: true });
    factory.sphere({ name: `Oak:${id}:crown`, radius: 1.9, position: [x, 3.8, z], material: palette.accent, scale: [1.2, 0.9, 1.1], collision: false });
  }
  factory.sphere({ name: 'RuneCrystal', radius: 1.15, position: [0, 1.2, -8], material: palette.trim, scale: [0.65, 1.8, 0.65], collision: true });
  addStrip(factory, palette.trim, 'RuneMark', [0, 2.7, -8], [0.18, 0.05, 2]);
  addMapLighting(factory, {
    sky: 0xffd6a4, ground: 0x221d17, key: 0xffd3a1, keyPosition: [-18, 28, 12],
    accents: [[0xff9f48, [-20, 4, -13], 7, 22], [0x59e1cf, [0, 4, -8], 8, 18]],
  });

  const graph = createGraph([
    ['south', [0, 0, 22], ['spawn', 'road']], ['village-west', [-17, 0, 10], ['village', 'interior', 'cover']], ['village-east', [17, 0, 10], ['village', 'interior', 'cover']],
    ['market', [0, 0, 9], ['central', 'open']], ['ruins', [-5, 0, -2], ['ruins', 'cover']], ['crystal', [0, 0, -8], ['landmark', 'cover']],
    ['gate', [0, 0, -20], ['gate', 'sniper']], ['bridge-west', [18, 0, 1], ['bridge']], ['bridge-east', [26, 0, 1], ['bridge', 'cover']],
  ], [['south', 'village-west'], ['south', 'village-east'], ['village-west', 'market'], ['village-east', 'market'], ['market', 'ruins'], ['market', 'crystal'], ['crystal', 'gate'], ['village-east', 'bridge-west'], ['bridge-west', 'bridge-east']]);
  const cover = createCover([
    ['village-west-house', [-17, 0, 10], ['cover', 'interior']], ['village-east-house', [17, 0, 10], ['cover', 'interior']], ['market-stall', [5, 0, 9], ['cover']], ['ruined-wall', [-5, 0, -2], ['cover']], ['crystal', [0, 0, -8], ['cover']], ['bridge-rail', [19, 0, 1], ['cover']],
  ]);
  return createOutput(factory, graph, cover,
    [spawn('fantasy-player-market', [0, 0, 22], Math.PI, ['player', 'market'])],
    [spawn('fantasy-scout-west', [-17, 0, 10], 0, ['npc', 'village'], 'scout'), spawn('fantasy-rifleman-east', [17, 0, 10], 0, ['npc', 'village'], 'rifleman'), spawn('fantasy-heavy-gate', [-8, 0, -20], Math.PI, ['npc', 'gate'], 'heavy'), spawn('fantasy-sniper-bridge', [26, 0, 1], Math.PI, ['npc', 'bridge'], 'sniper')],
    [{ id: 'fantasy-ammo-village', type: 'ammo', position: [-17, 0.9, 10], amount: 30, respawnSeconds: 8 }, { id: 'fantasy-ammo-ruins', type: 'ammo', position: [-5, 0.9, -2], amount: 30, respawnSeconds: 8 }, { id: 'fantasy-ammo-gate', type: 'ammo', position: [0, 0.9, -20], amount: 45, respawnSeconds: 8 }],
    [{ id: 'fantasy-target-market', position: [0, 0, 9], maxHealth: 100, respawnDelay: 3, accentColor: 0x69d7c4 }, { id: 'fantasy-target-ruins', position: [-5, 0, -2], maxHealth: 120, respawnDelay: 4, accentColor: 0xffb35b }, { id: 'fantasy-target-gate', position: [0, 0, -20], maxHealth: 100, respawnDelay: 3, accentColor: 0xb5e0a0 }],
  );
}
