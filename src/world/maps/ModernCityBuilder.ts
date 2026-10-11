import type { MapBuildOutput } from '../MapDefinition';
import { GeometryFactory } from '../geometry/GeometryFactory';
import { addStrip, createMaterialPalette } from '../geometry/MaterialLibrary';
import { addArenaShell, addLightBeacon, addMapLighting, createCover, createGraph, createOutput, spawn } from './MapBuilderUtils';

export function buildModernCity(): MapBuildOutput {
  const factory = new GeometryFactory('Map:ModernCity');
  const palette = createMaterialPalette(factory, {
    floor: 0x2e3741, structure: 0x55616c, secondary: 0x8b98a1, dark: 0x111a22,
    trim: 0x46dff3, warning: 0xffad55, accent: 0x7ec6ff,
  });
  addArenaShell(factory, palette, 60, 52, 8);
  factory.grid(60, 30, [0, 0.012, 0], [0x596a76, 0x293640]);

  // Main avenue, plaza, and sidewalks.
  factory.box({ name: 'MainAvenue', size: [15, 0.025, 42], position: [0, 0.03, 0], material: palette.dark, collision: false });
  factory.box({ name: 'EastSidewalk', size: [8, 0.05, 42], position: [12, 0.04, 0], material: palette.secondary, collision: false });
  factory.box({ name: 'WestSidewalk', size: [8, 0.05, 42], position: [-12, 0.04, 0], material: palette.secondary, collision: false });
  for (const z of [-17, -5, 7, 19]) addStrip(factory, palette.warning, `LaneMarking:${z}`, [0, 0.07, z], [0.18, 0.04, 3.2]);

  // Commercial and residential blocks create the city's readable skyline.
  const building = (name: string, position: [number, number, number], size: [number, number, number], material = palette.structure): void => {
    factory.box({ name, size, position, material });
    factory.box({ name: `${name}:roof`, size: [size[0] + 0.25, 0.18, size[2] + 0.25], position: [position[0], position[1] + size[1] / 2 + 0.1, position[2]], material: palette.dark });
  };
  building('CommercialWest', [-22, 4.2, -12], [10, 8.4, 14]);
  building('CommercialEast', [22, 3.3, -13], [10, 6.6, 13], palette.secondary);
  building('ApartmentWest', [-22, 3.4, 11], [10, 6.8, 13], palette.secondary);
  building('ApartmentEast', [22, 4.6, 11], [10, 9.2, 13]);
  for (const x of [-22, 22]) {
    for (const z of [-15, -10, 8, 13]) addStrip(factory, palette.accent, `Window:${x}:${z}`, [x, 4.3, z], [0.12, 0.72, 1.1]);
  }
  factory.box({ name: 'Shopfront', size: [8, 2.4, 0.25], position: [0, 1.2, -20], material: palette.secondary });
  addStrip(factory, palette.trim, 'ShopSign', [0, 2.8, -20.18], [5, 0.45, 0.08]);

  // A connected, open residential interior with doorway gaps.
  factory.box({ name: 'HouseFloor', size: [8, 0.2, 7], position: [12, 0.1, 13], material: palette.floor });
  factory.box({ name: 'HouseWallNorth', size: [8, 3.2, 0.3], position: [12, 1.6, 9.5], material: palette.structure });
  factory.box({ name: 'HouseWallSouthLeft', size: [3, 3.2, 0.3], position: [9.5, 1.6, 16.5], material: palette.structure });
  factory.box({ name: 'HouseWallSouthRight', size: [3, 3.2, 0.3], position: [14.5, 1.6, 16.5], material: palette.structure });
  factory.box({ name: 'HouseWallWest', size: [0.3, 3.2, 7], position: [8, 1.6, 13], material: palette.structure });
  factory.box({ name: 'HouseWallEast', size: [0.3, 3.2, 7], position: [16, 1.6, 13], material: palette.structure });
  factory.box({ name: 'HouseTable', size: [1.8, 0.75, 0.9], position: [12, 0.48, 12], material: palette.dark });
  factory.box({ name: 'HouseCounter', size: [2.5, 1, 0.45], position: [14, 0.5, 15], material: palette.secondary });

  // A second accessible interior keeps the city from being a solid blockout.
  factory.box({ name: 'CafeFloor', size: [7, 0.2, 6], position: [-12, 0.1, -13], material: palette.floor });
  factory.box({ name: 'CafeWallNorth', size: [7, 3.1, 0.3], position: [-12, 1.55, -16], material: palette.structure });
  factory.box({ name: 'CafeWallWest', size: [0.3, 3.1, 6], position: [-15.5, 1.55, -13], material: palette.structure });
  factory.box({ name: 'CafeWallEast', size: [0.3, 3.1, 6], position: [-8.5, 1.55, -13], material: palette.structure });
  factory.box({ name: 'CafeWallSouthLeft', size: [2.4, 3.1, 0.3], position: [-14.3, 1.55, -10], material: palette.structure });
  factory.box({ name: 'CafeWallSouthRight', size: [2.4, 3.1, 0.3], position: [-9.7, 1.55, -10], material: palette.structure });
  factory.box({ name: 'CafeCounter', size: [3.6, 1, 0.45], position: [-12, 0.5, -15], material: palette.secondary });
  factory.box({ name: 'CafeTable', size: [1.3, 0.7, 1.3], position: [-10.4, 0.45, -12], material: palette.dark });
  addStrip(factory, palette.trim, 'CafeSign', [-12, 2.9, -10.18], [4, 0.35, 0.08]);

  // Park and street furniture.
  factory.box({ name: 'CityPark', size: [12, 0.08, 12], position: [-12, 0.06, 4], material: palette.floor, collision: false });
  for (const [x, z] of [[-16, 0], [-8, 0], [-16, 8], [-8, 8]] as Array<[number, number]>) {
    factory.cylinder({ name: `ParkTreeTrunk:${x}:${z}`, radius: 0.28, height: 2.6, position: [x, 1.3, z], material: palette.dark, collision: true });
    factory.sphere({ name: `ParkTreeCrown:${x}:${z}`, radius: 1.5, position: [x, 3.2, z], material: palette.accent, scale: [1.15, 0.9, 1.15], collision: false });
  }
  factory.box({ name: 'ParkBench', size: [2.5, 0.35, 0.5], position: [-12, 0.6, 4], material: palette.secondary });
  factory.box({ name: 'ParkBenchBack', size: [2.5, 0.65, 0.18], position: [-12, 1.05, 4.2], material: palette.secondary });

  // Static vehicles provide recognizable city cover.
  for (const [id, x, z, color] of [['sedan-west', -5, 14, palette.secondary], ['van-east', 7, -14, palette.structure]] as const) {
    factory.box({ name: `Vehicle:${id}:body`, size: [2.1, 0.7, 4.2], position: [x, 0.55, z], material: color });
    factory.box({ name: `Vehicle:${id}:cabin`, size: [1.65, 0.55, 1.7], position: [x, 1.12, z - 0.1], material: palette.dark });
    for (const wheelZ of [-1.25, 1.25]) factory.cylinder({ name: `Vehicle:${id}:wheel:${wheelZ}`, radius: 0.32, height: 0.18, position: [x - 1.05, 0.36, z + wheelZ], material: palette.dark, collision: false });
  }
  factory.box({ name: 'AlleyBarrier', size: [4, 1.2, 0.8], position: [-4, 0.6, -8], material: palette.warning });
  addLightBeacon(factory, palette.trim, 'StreetLightWest', [-6, 3.4, -3]);
  addLightBeacon(factory, palette.warning, 'StreetLightEast', [7, 3.4, 7]);
  addMapLighting(factory, {
    sky: 0xffe4bc, ground: 0x1c2630, key: 0xffe0b1, keyPosition: [-20, 28, 15],
    accents: [[0x49dcff, [-8, 4, -5], 9, 30], [0xffa74f, [12, 4, 11], 8, 28]],
  });

  const graph = createGraph([
    ['south', [0, 0, 21], ['spawn', 'road']], ['west-south', [-9, 0, 15], ['road', 'cover']], ['east-south', [9, 0, 15], ['road', 'cover']],
    ['plaza', [0, 0, 5], ['central']], ['park', [-12, 0, 4], ['park', 'cover']], ['west-north', [-9, 0, -13], ['alley', 'cover']],
    ['east-north', [9, 0, -13], ['alley', 'cover']], ['north', [0, 0, -21], ['road', 'sniper']], ['house', [12, 0, 13], ['interior', 'cover']], ['cafe', [-12, 0, -13], ['interior', 'cover']],
  ], [['south', 'west-south'], ['south', 'east-south'], ['west-south', 'plaza'], ['east-south', 'plaza'], ['plaza', 'park'], ['plaza', 'west-north'], ['plaza', 'east-north'], ['west-north', 'north'], ['east-north', 'north'], ['east-south', 'house'], ['west-north', 'cafe']]);
  const cover = createCover([
    ['sedan-west', [-5, 0, 14], ['cover', 'vehicle']], ['van-east', [7, 0, -14], ['cover', 'vehicle']], ['park-bench', [-12, 0, 4], ['cover']],
    ['west-alley', [-9, 0, -13], ['cover']], ['east-alley', [9, 0, -13], ['cover']], ['house-counter', [14, 0, 15], ['cover', 'interior']], ['cafe-counter', [-12, 0, -15], ['cover', 'interior']],
  ]);
  return createOutput(factory, graph, cover,
    [spawn('city-player-plaza', [0, 0, 21], Math.PI, ['player', 'plaza'])],
    [spawn('city-scout-west', [-9, 0, 15], 0, ['npc', 'west'], 'scout'), spawn('city-rifleman-east', [9, 0, 15], 0, ['npc', 'east'], 'rifleman'), spawn('city-heavy-north', [-9, 0, -17], Math.PI, ['npc', 'north'], 'heavy'), spawn('city-sniper-roof', [9, 0, -17], Math.PI, ['npc', 'north'], 'sniper')],
    [{ id: 'city-ammo-park', type: 'ammo', position: [-12, 0.9, 4], amount: 30, respawnSeconds: 8 }, { id: 'city-ammo-alley', type: 'ammo', position: [-9, 0.9, -13], amount: 30, respawnSeconds: 8 }, { id: 'city-ammo-house', type: 'ammo', position: [12, 0.9, 13], amount: 45, respawnSeconds: 8 }],
    [{ id: 'city-target-plaza', position: [0, 0, 5], maxHealth: 100, respawnDelay: 3, accentColor: 0x46dff3 }, { id: 'city-target-park', position: [-12, 0, 4], maxHealth: 120, respawnDelay: 4, accentColor: 0x79ff9d }, { id: 'city-target-north', position: [0, 0, -21], maxHealth: 100, respawnDelay: 3, accentColor: 0xffad55 }],
  );
}
