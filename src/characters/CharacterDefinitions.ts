import type { CharacterDefinition } from './CharacterTypes';

export const CHARACTER_DEFINITIONS: readonly CharacterDefinition[] = [
  {
    id: 'vanguard', displayName: 'VANGUARD', category: 'tactical', silhouette: 'balanced',
    description: 'A disciplined tactical operative built for the front line.', visualTheme: 'Cyan tactical armor', previewScale: 1,
    palettes: [
      { id: 'midnight-cyan', displayName: 'Midnight Cyan', primary: 0x20344a, secondary: 0x526c80, accent: 0x48e7ff, visor: 0xbffaff, emissive: 0x00b8d4 },
      { id: 'ember-command', displayName: 'Ember Command', primary: 0x3d2730, secondary: 0x806052, accent: 0xff7e4f, visor: 0xffd6aa, emissive: 0xe34f2b },
    ],
    outfitVariantIds: ['standard', 'reinforced'], headVariantIds: ['visor', 'helmet'], accessoryIds: ['shoulder-plate'],
    defaultAppearance: { paletteId: 'midnight-cyan', outfitVariantId: 'standard', headVariantId: 'visor', accessoryIds: [] },
  },
  {
    id: 'volt', displayName: 'VOLT', category: 'specialist', silhouette: 'angular',
    description: 'A lightweight-looking specialist wrapped in reactive blue circuitry.', visualTheme: 'Electric blue circuitry', previewScale: 0.98,
    palettes: [
      { id: 'electric-blue', displayName: 'Electric Blue', primary: 0x172e50, secondary: 0x3c6aa0, accent: 0x5effff, visor: 0x91d8ff, emissive: 0x00d9ff },
      { id: 'acid-lime', displayName: 'Acid Lime', primary: 0x253a2d, secondary: 0x5d8b5c, accent: 0xb4ff68, visor: 0xd9ffb0, emissive: 0x74d83e },
    ],
    outfitVariantIds: ['standard', 'pulse'], headVariantIds: ['visor', 'split-visor'], accessoryIds: ['back-cell'],
    defaultAppearance: { paletteId: 'electric-blue', outfitVariantId: 'pulse', headVariantId: 'split-visor', accessoryIds: [] },
  },
  {
    id: 'bastion', displayName: 'BASTION', category: 'armored', silhouette: 'heavy',
    description: 'A reinforced combatant with broad armor and restrained warning accents.', visualTheme: 'Graphite heavy armor', previewScale: 1.08,
    palettes: [
      { id: 'graphite-orange', displayName: 'Graphite Orange', primary: 0x29323a, secondary: 0x59636a, accent: 0xff9c48, visor: 0xffd08a, emissive: 0xe46324 },
      { id: 'ceramic-white', displayName: 'Ceramic White', primary: 0xb6c8cf, secondary: 0x5c7180, accent: 0xffd36f, visor: 0xe6fbff, emissive: 0xff9a36 },
    ],
    outfitVariantIds: ['standard', 'bulwark'], headVariantIds: ['helmet', 'sealed-helmet'], accessoryIds: ['shoulder-plate', 'back-cell'],
    defaultAppearance: { paletteId: 'graphite-orange', outfitVariantId: 'bulwark', headVariantId: 'helmet', accessoryIds: ['shoulder-plate'] },
  },
  {
    id: 'ghostline', displayName: 'GHOSTLINE', category: 'precision', silhouette: 'slender',
    description: 'A precision-oriented operative with a narrow profile and cold visor glow.', visualTheme: 'Cool precision shell', previewScale: 1,
    palettes: [
      { id: 'frostline', displayName: 'Frostline', primary: 0x26364e, secondary: 0x667e98, accent: 0xa4d9ff, visor: 0xe5f8ff, emissive: 0x66b9ff },
      { id: 'violet-night', displayName: 'Violet Night', primary: 0x29233e, secondary: 0x655a88, accent: 0xc09cff, visor: 0xf1e7ff, emissive: 0x9666ff },
    ],
    outfitVariantIds: ['standard', 'longcoat'], headVariantIds: ['visor', 'hooded-visor'], accessoryIds: ['shoulder-plate'],
    defaultAppearance: { paletteId: 'frostline', outfitVariantId: 'longcoat', headVariantId: 'hooded-visor', accessoryIds: [] },
  },
  {
    id: 'circuit', displayName: 'CIRCUIT', category: 'synthetic', silhouette: 'robotic',
    description: 'A synthetic training unit with modular panels and a bright sensor core.', visualTheme: 'Synthetic cyan machine', previewScale: 1,
    palettes: [
      { id: 'sensor-cyan', displayName: 'Sensor Cyan', primary: 0x263b43, secondary: 0x748f96, accent: 0x47f0ff, visor: 0x9fffff, emissive: 0x00e5ff },
      { id: 'amber-protocol', displayName: 'Amber Protocol', primary: 0x44352a, secondary: 0x97805c, accent: 0xffc75e, visor: 0xfff0b0, emissive: 0xff8a28 },
    ],
    outfitVariantIds: ['standard', 'industrial'], headVariantIds: ['sensor', 'dual-sensor'], accessoryIds: ['back-cell'],
    defaultAppearance: { paletteId: 'sensor-cyan', outfitVariantId: 'industrial', headVariantId: 'dual-sensor', accessoryIds: [] },
  },
];

export function getCharacterDefinition(id: string): CharacterDefinition {
  const definition = CHARACTER_DEFINITIONS.find((entry) => entry.id === id);
  if (!definition) throw new Error(`Unknown character definition: ${id}`);
  return definition;
}
