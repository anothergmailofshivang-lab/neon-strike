import type { CharacterAppearance, CharacterDefinition } from './CharacterTypes';

export function defaultAppearance(definition: CharacterDefinition): CharacterAppearance {
  return { characterId: definition.id, ...definition.defaultAppearance, accessoryIds: [...definition.defaultAppearance.accessoryIds] };
}

export function validateAppearance(definition: CharacterDefinition, appearance: CharacterAppearance): CharacterAppearance {
  if (appearance.characterId !== definition.id) throw new Error(`Appearance ${appearance.characterId} does not belong to ${definition.id}.`);
  const palette = definition.palettes.find((entry) => entry.id === appearance.paletteId);
  if (!palette) throw new Error(`Unknown palette ${appearance.paletteId} for ${definition.id}.`);
  if (!definition.outfitVariantIds.includes(appearance.outfitVariantId)) throw new Error(`Unknown outfit ${appearance.outfitVariantId} for ${definition.id}.`);
  if (!definition.headVariantIds.includes(appearance.headVariantId)) throw new Error(`Unknown head variant ${appearance.headVariantId} for ${definition.id}.`);
  if (!Array.isArray(appearance.accessoryIds) || appearance.accessoryIds.some((id) => !definition.accessoryIds.includes(id))) {
    throw new Error(`Unsupported accessory for ${definition.id}.`);
  }
  const accessoryIds = appearance.accessoryIds;
  return { characterId: definition.id, paletteId: palette.id, outfitVariantId: appearance.outfitVariantId, headVariantId: appearance.headVariantId, accessoryIds: [...new Set(accessoryIds)] };
}

export class CharacterSelection {
  private characterId: string;
  private appearanceValue: CharacterAppearance;

  public constructor(private readonly registry: { get: (id: string) => CharacterDefinition }, characterId = 'vanguard', appearance?: CharacterAppearance) {
    const definition = registry.get(characterId);
    this.characterId = definition.id;
    this.appearanceValue = validateAppearance(definition, appearance ?? defaultAppearance(definition));
  }

  public get selectedCharacterId(): string { return this.characterId; }
  public get appearance(): CharacterAppearance { return { ...this.appearanceValue, accessoryIds: [...this.appearanceValue.accessoryIds] }; }
  public get definition(): CharacterDefinition { return this.registry.get(this.characterId); }

  public selectCharacter(id: string): CharacterAppearance {
    const definition = this.registry.get(id);
    if (this.characterId === id) return this.appearance;
    this.characterId = definition.id;
    this.appearanceValue = defaultAppearance(definition);
    return this.appearance;
  }

  public setAppearance(appearance: CharacterAppearance): CharacterAppearance {
    const definition = this.registry.get(appearance.characterId);
    const validated = validateAppearance(definition, appearance);
    this.characterId = definition.id;
    this.appearanceValue = validated;
    return this.appearance;
  }

  public setPalette(paletteId: string): CharacterAppearance {
    return this.setAppearance({ ...this.appearanceValue, paletteId });
  }

  public setOutfit(outfitVariantId: string): CharacterAppearance {
    return this.setAppearance({ ...this.appearanceValue, outfitVariantId });
  }

  public setHeadVariant(headVariantId: string): CharacterAppearance {
    return this.setAppearance({ ...this.appearanceValue, headVariantId });
  }

  public resetAppearance(): CharacterAppearance {
    this.appearanceValue = defaultAppearance(this.definition);
    return this.appearance;
  }
}
