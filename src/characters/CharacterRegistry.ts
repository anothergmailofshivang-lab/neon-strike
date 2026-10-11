import type { CharacterDefinition } from './CharacterTypes';

export class CharacterRegistry {
  private readonly definitions = new Map<string, CharacterDefinition>();

  public constructor(definitions: readonly CharacterDefinition[]) {
    for (const definition of definitions) this.register(definition);
  }

  public register(definition: CharacterDefinition): void {
    validateCharacterDefinition(definition);
    if (this.definitions.has(definition.id)) throw new Error(`Character ID is already registered: ${definition.id}`);
    this.definitions.set(definition.id, freezeDefinition(structuredClone(definition)));
  }

  public get(id: string): CharacterDefinition {
    const definition = this.definitions.get(id);
    if (!definition) throw new Error(`Unknown character ID: ${id}`);
    return definition;
  }

  public has(id: string): boolean {
    return this.definitions.has(id);
  }

  public list(): readonly CharacterDefinition[] {
    return [...this.definitions.values()];
  }
}

export function validateCharacterDefinition(definition: CharacterDefinition): CharacterDefinition {
  if (!definition.id.trim() || !definition.displayName.trim() || !definition.description.trim()) {
    throw new Error('Character definitions require non-empty IDs, names, and descriptions.');
  }
  if (definition.palettes.length < 2) throw new Error(`Character ${definition.id} requires at least two palettes.`);
  const paletteIds = new Set<string>();
  for (const palette of definition.palettes) {
    if (paletteIds.has(palette.id)) throw new Error(`Duplicate palette ${palette.id} on ${definition.id}.`);
    paletteIds.add(palette.id);
  }
  if (!paletteIds.has(definition.defaultAppearance.paletteId)) throw new Error(`Default palette is missing on ${definition.id}.`);
  if (!definition.outfitVariantIds.includes(definition.defaultAppearance.outfitVariantId)) throw new Error(`Default outfit is missing on ${definition.id}.`);
  if (!definition.headVariantIds.includes(definition.defaultAppearance.headVariantId)) throw new Error(`Default head variant is missing on ${definition.id}.`);
  if (!Number.isFinite(definition.previewScale) || definition.previewScale <= 0) throw new Error(`Invalid scale on ${definition.id}.`);
  if (definition.defaultAppearance.accessoryIds.some((id) => !definition.accessoryIds.includes(id))) throw new Error(`Default accessory is missing on ${definition.id}.`);
  for (const palette of definition.palettes) {
    for (const color of [palette.primary, palette.secondary, palette.accent, palette.visor, palette.emissive]) {
      if (!Number.isInteger(color) || color < 0 || color > 0xffffff) throw new Error(`Invalid palette color on ${definition.id}.`);
    }
  }
  return definition;
}

function freezeDefinition<T extends object>(value: T): T {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') freezeDefinition(child);
  }
  return Object.freeze(value);
}
