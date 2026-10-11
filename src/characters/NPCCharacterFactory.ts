import type { NPCArchetypeDefinition } from '../ai/NPCDefinitions';
import { getCharacterDefinitionForNPC } from './NPCVisualVariants';
import { createCharacterVisual } from './CharacterFactory';
import type { CharacterVisual } from './CharacterTypes';

export interface NPCVisual extends CharacterVisual {}

export function createNPCVisual(definition: NPCArchetypeDefinition): NPCVisual {
  const variant = getCharacterDefinitionForNPC(definition.id);
  const visual = createCharacterVisual(variant, { characterId: variant.id, ...variant.defaultAppearance });
  visual.root.name = `NPC:${definition.id}:${variant.id}`;
  visual.root.scale.multiplyScalar(definition.scale);
  return visual;
}
