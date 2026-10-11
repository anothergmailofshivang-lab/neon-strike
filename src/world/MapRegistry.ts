import type { MapDefinition } from './MapDefinition';

export class MapRegistry {
  private readonly definitions = new Map<string, MapDefinition>();

  public register(definition: MapDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Map ID is already registered: ${definition.id}`);
    }
    validateMapDefinition(definition);
    this.definitions.set(definition.id, definition);
  }

  public registerAll(definitions: readonly MapDefinition[]): void {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  public has(id: string): boolean {
    return this.definitions.has(id);
  }

  public get(id: string): MapDefinition {
    const definition = this.definitions.get(id);
    if (!definition) {
      throw new Error(`Unknown map ID: ${id}`);
    }
    return definition;
  }

  public list(): readonly MapDefinition[] {
    return [...this.definitions.values()];
  }
}

export function validateMapDefinition(definition: MapDefinition): MapDefinition {
  if (!definition.id.trim() || !definition.displayName.trim() || !definition.description.trim()) {
    throw new Error('Map definitions require non-empty IDs, names, and descriptions.');
  }
  if (!Number.isFinite(definition.dimensions[0]) || !Number.isFinite(definition.dimensions[1]) || definition.dimensions[0] <= 0 || definition.dimensions[1] <= 0) {
    throw new Error(`Map ${definition.id} has invalid dimensions.`);
  }
  if (!definition.build) {
    throw new Error(`Map ${definition.id} has no builder.`);
  }
  const objectiveIds = new Set<string>();
  for (const point of definition.controlPoints) {
    if (!point.id.trim() || objectiveIds.has(point.id)) throw new Error(`Map ${definition.id} has duplicate control point ID: ${point.id}`);
    objectiveIds.add(point.id);
    if (!point.displayName.trim() || point.radius <= 0 || point.position.some((value) => !Number.isFinite(value))) {
      throw new Error(`Map ${definition.id} has invalid control point: ${point.id}`);
    }
  }
  return definition;
}

export function createMapRegistry(definitions: readonly MapDefinition[]): MapRegistry {
  const registry = new MapRegistry();
  registry.registerAll(definitions);
  return registry;
}
