import type { MapDefinition } from '../MapDefinition';
import { buildDustlineDepot } from './DustlineDepotBuilder';
import { buildNeonYard } from './NeonYardBuilder';
import { buildSkybridge } from './SkybridgeBuilder';

export const MAP_DEFINITIONS: readonly MapDefinition[] = [
  {
    id: 'neon-yard', displayName: 'NEON YARD',
    description: 'Compact combat training facility with fast loops, central cover, and an elevated west route.',
    tacticalTags: ['Close-Range', 'Training', 'Loop Routes'], dimensions: [52, 46],
    lighting: { backgroundColor: 0x07111f, fog: { color: 0x07111f, near: 70, far: 180 } }, build: buildNeonYard,
  },
  {
    id: 'dustline-depot', displayName: 'DUSTLINE DEPOT',
    description: 'Warm industrial cargo lanes with container cover, long sightlines, and a loading-platform flank.',
    tacticalTags: ['Industrial', 'Midrange', 'Flanking'], dimensions: [60, 50],
    lighting: { backgroundColor: 0x241912, fog: { color: 0x241912, near: 75, far: 190 } }, build: buildDustlineDepot,
  },
  {
    id: 'skybridge', displayName: 'SKYBRIDGE',
    description: 'Layered futuristic facility where ramps, bridges, and exposed elevation crossings shape every fight.',
    tacticalTags: ['Vertical', 'Bridges', 'Long Sightlines'], dimensions: [60, 52],
    lighting: { backgroundColor: 0x0b1a2a, fog: { color: 0x0b1a2a, near: 80, far: 210 } }, build: buildSkybridge,
  },
];
