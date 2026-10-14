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
    lighting: { backgroundColor: 0x101a24, fog: { color: 0x101a24, near: 70, far: 180 } },
    controlPoints: [
      { id: 'city-market', displayName: 'MARKET', position: [0, 0, 5], radius: 4.5, tags: ['central', 'open'] },
      { id: 'city-park', displayName: 'PARK', position: [-12, 0, 6], radius: 3, tags: ['cover'] },
      { id: 'city-north', displayName: 'NORTH', position: [2, 0, -14], radius: 3, tags: ['lane'] },
    ],
    doors: [{ id: 'city-house-door', label: 'Residence door', hinge: [11.06, 0.2, 16.5], width: 1.88, height: 2.9, color: 0x405b70 }],
    interactions: [
      { id: 'city-market-console', type: 'switch', label: 'Market beacon', position: [2, 0.9, 5], radius: 2.5, color: 0x46dff3 },
      { id: 'city-house-control', type: 'switch', label: 'Residence door control', position: [10.6, 1.3, 17], radius: 2.5, color: 0x46dff3, doorId: 'city-house-door' },
    ], destructibles: [{ id: 'city-crate-alley', position: [4, 0.7, 14], size: [1.6, 1.4, 1.6], maxHealth: 80, materialColor: 0xb57b4e }], build: buildModernCity,
  },
  {
    id: 'industrial-facility', displayName: 'INDUSTRIAL FACILITY',
    description: 'Warm industrial cargo lanes with container cover, long sightlines, and a loading-platform flank.',
    tacticalTags: ['Industrial', 'Midrange', 'Flanking'], dimensions: [60, 50],
    lighting: { backgroundColor: 0x241912, fog: { color: 0x241912, near: 75, far: 190 } },
    controlPoints: [
      { id: 'industrial-loading', displayName: 'LOADING', position: [0, 0, -4], radius: 3, tags: ['central', 'cover'] },
      { id: 'industrial-west', displayName: 'WEST', position: [-11, 0, 7], radius: 4, tags: ['cover'] },
      { id: 'industrial-platform', displayName: 'EAST LANE', position: [12, 0, -12], radius: 3, tags: ['lane', 'cover'] },
    ], interactions: [{ id: 'industrial-loading-switch', type: 'switch', label: 'Loading signal lamp', position: [0, 0.9, 0], radius: 2.5, color: 0xffaa4e }], destructibles: [{ id: 'industrial-crate-west', position: [-7.5, 0.7, 12], size: [1.8, 1.4, 1.8], maxHealth: 95, materialColor: 0x9a7652 }], build: buildDustlineDepot,
  },
  {
    id: 'jungle-forest', displayName: 'JUNGLE FRONTIER',
    description: 'A dense forest trail with trees, rocks, a cabin, a stream crossing, and a defended outpost.',
    tacticalTags: ['Forest', 'Natural Cover', 'Close-Range'], dimensions: [64, 56],
    lighting: { backgroundColor: 0x1a2b1b, fog: { color: 0x1a2b1b, near: 65, far: 170 } },
    controlPoints: [
      { id: 'forest-clearing', displayName: 'CLEARING', position: [0, 0, 4], radius: 4.5, tags: ['central', 'open'] },
      { id: 'forest-cabin', displayName: 'CABIN APPROACH', position: [-10, 0, 4], radius: 3, tags: ['cover'] },
      { id: 'forest-bridge', displayName: 'STREAM BANK', position: [12, 0, 4], radius: 3, tags: ['bridge'] },
    ], interactions: [{ id: 'forest-outpost-switch', type: 'switch', label: 'Outpost lamp', position: [12, 1.3, 14.5], radius: 2.5, color: 0x79ff9d }], destructibles: [{ id: 'forest-supply-crate', position: [4, 0.7, 12], size: [1.7, 1.4, 1.7], maxHealth: 80, materialColor: 0x80613f }], build: buildJungleForest,
  },
  {
    id: 'sci-fi-facility', displayName: 'SCI-FI FACILITY',
    description: 'Layered futuristic facility where ramps, bridges, and exposed elevation crossings shape every fight.',
    tacticalTags: ['Sci-Fi', 'Vertical', 'Long Sightlines'], dimensions: [60, 52],
    lighting: { backgroundColor: 0x0b1a2a, fog: { color: 0x0b1a2a, near: 80, far: 210 } },
    controlPoints: [
      { id: 'sci-fi-lower', displayName: 'LOWER', position: [0, 0, 7], radius: 4, tags: ['lower', 'cover'] },
      { id: 'sci-fi-west', displayName: 'WEST COURT', position: [-10, 0, -10], radius: 3, tags: ['lower', 'cover'] },
      { id: 'sci-fi-east', displayName: 'EAST COURT', position: [10, 0, 10], radius: 3, tags: ['lower', 'cover'] },
    ], interactions: [{ id: 'sci-fi-terminal', type: 'switch', label: 'Facility floodlight', position: [0, 0.9, 7], radius: 2.5, color: 0x67eaff }], destructibles: [{ id: 'sci-fi-panel', position: [-5, 0.7, 8], size: [1.6, 1.4, 1.6], maxHealth: 90, materialColor: 0x557b94 }], build: buildSkybridge,
  },
  {
    id: 'fantasy-ruins', displayName: 'FANTASY RUINS',
    description: 'A ruined kingdom with castle walls, village houses, market stalls, towers, and a rune crystal landmark.',
    tacticalTags: ['Fantasy', 'Ruins', 'Mixed Range'], dimensions: [64, 56],
    lighting: { backgroundColor: 0x2b2119, fog: { color: 0x2b2119, near: 70, far: 175 } },
    controlPoints: [
      { id: 'fantasy-market', displayName: 'MARKET', position: [0, 0, 9], radius: 4.5, tags: ['central', 'open'] },
      { id: 'fantasy-ruins', displayName: 'RUINS', position: [-12, 0, -6], radius: 3, tags: ['cover'] },
      { id: 'fantasy-gate', displayName: 'GATE', position: [0, 0, -20], radius: 4, tags: ['gate'] },
    ], interactions: [{ id: 'fantasy-gate-switch', type: 'switch', label: 'Gate lantern', position: [0, 0.9, -20], radius: 2.5, color: 0xffc857 }], destructibles: [{ id: 'fantasy-timber-crate', position: [8, 0.7, 12], size: [1.7, 1.4, 1.7], maxHealth: 80, materialColor: 0x8f5b39 }], build: buildFantasyRuins,
  },
];
