import { describe, expect, it } from 'vitest';
import { MapRegistry, createMapRegistry } from '../src/world/MapRegistry';
import { MAP_DEFINITIONS } from '../src/world/maps/MapCatalog';

describe('map registry', () => {
  it('registers the three distinct Phase 04 maps', () => {
    const registry = createMapRegistry(MAP_DEFINITIONS);
    expect(registry.list().map((map) => map.id)).toEqual(['neon-yard', 'dustline-depot', 'skybridge']);
    expect(registry.get('skybridge').tacticalTags).toContain('Vertical');
  });

  it('rejects duplicate map IDs and unknown selections', () => {
    const registry = new MapRegistry();
    registry.register(MAP_DEFINITIONS[0]);
    expect(() => registry.register(MAP_DEFINITIONS[0])).toThrow(/already registered/);
    expect(() => registry.get('missing-map')).toThrow(/Unknown map ID/);
  });
});
