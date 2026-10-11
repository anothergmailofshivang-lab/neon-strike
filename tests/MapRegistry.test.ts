import { describe, expect, it } from 'vitest';
import { MapRegistry, createMapRegistry } from '../src/world/MapRegistry';
import { MAP_DEFINITIONS } from '../src/world/maps/MapCatalog';

describe('map registry', () => {
  it('registers the five distinct player-facing map experiences', () => {
    const registry = createMapRegistry(MAP_DEFINITIONS);
    expect(registry.list().map((map) => map.id)).toEqual(['modern-city', 'industrial-facility', 'jungle-forest', 'sci-fi-facility', 'fantasy-ruins']);
    expect(registry.get('sci-fi-facility').tacticalTags).toContain('Vertical');
  });

  it('rejects duplicate map IDs and unknown selections', () => {
    const registry = new MapRegistry();
    registry.register(MAP_DEFINITIONS[0]);
    expect(() => registry.register(MAP_DEFINITIONS[0])).toThrow(/already registered/);
    expect(() => registry.get('missing-map')).toThrow(/Unknown map ID/);
  });
});
