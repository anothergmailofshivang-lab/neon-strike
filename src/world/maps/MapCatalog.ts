import type { MapDefinition } from '../MapDefinition';
import { buildDustlineDepot } from './DustlineDepotBuilder';
import { buildFantasyRuins } from './FantasyRuinsBuilder';
import { buildJungleForest } from './JungleForestBuilder';
import { buildModernCity } from './ModernCityBuilder';
import { buildSkybridge } from './SkybridgeBuilder';

export const MAP_DEFINITIONS: readonly MapDefinition[] = [
  {
    id: 'modern-city', displayName: 'MODERN CITY',
    description: 'A neon-lit city block with an avenue, park, accessible house, storefronts, and vehicle cover.',
    tacticalTags: ['Urban', 'Close-Range', 'Interiors'], dimensions: [60, 52],
    lighting: { backgroundColor: 0x101a24, fog: { color: 0x101a24, near: 70, far: 180 } }, build: buildModernCity,
  },
  {
    id: 'industrial-facility', displayName: 'INDUSTRIAL FACILITY',
    description: 'Warm industrial cargo lanes with container cover, long sightlines, and a loading-platform flank.',
    tacticalTags: ['Industrial', 'Midrange', 'Flanking'], dimensions: [60, 50],
    lighting: { backgroundColor: 0x241912, fog: { color: 0x241912, near: 75, far: 190 } }, build: buildDustlineDepot,
  },
  {
    id: 'jungle-forest', displayName: 'JUNGLE FRONTIER',
    description: 'A dense forest trail with trees, rocks, a cabin, a stream crossing, and a defended outpost.',
    tacticalTags: ['Forest', 'Natural Cover', 'Close-Range'], dimensions: [64, 56],
    lighting: { backgroundColor: 0x1a2b1b, fog: { color: 0x1a2b1b, near: 65, far: 170 } }, build: buildJungleForest,
  },
  {
    id: 'sci-fi-facility', displayName: 'SCI-FI FACILITY',
    description: 'Layered futuristic facility where ramps, bridges, and exposed elevation crossings shape every fight.',
    tacticalTags: ['Sci-Fi', 'Vertical', 'Long Sightlines'], dimensions: [60, 52],
    lighting: { backgroundColor: 0x0b1a2a, fog: { color: 0x0b1a2a, near: 80, far: 210 } }, build: buildSkybridge,
  },
  {
    id: 'fantasy-ruins', displayName: 'FANTASY RUINS',
    description: 'A ruined kingdom with castle walls, village houses, market stalls, towers, and a rune crystal landmark.',
    tacticalTags: ['Fantasy', 'Ruins', 'Mixed Range'], dimensions: [64, 56],
    lighting: { backgroundColor: 0x2b2119, fog: { color: 0x2b2119, near: 70, far: 175 } }, build: buildFantasyRuins,
  },
];
