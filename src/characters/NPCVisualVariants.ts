import { getCharacterDefinition } from './CharacterDefinitions';
import type { CharacterDefinition } from './CharacterTypes';

const VARIANTS: Readonly<Record<string, string>> = {
  scout: 'volt',
  rifleman: 'vanguard',
  heavy: 'bastion',
  sniper: 'ghostline',
  flanker: 'volt',
  defender: 'circuit',
};

export function getCharacterDefinitionForNPC(archetypeId: string): CharacterDefinition {
  return getCharacterDefinition(VARIANTS[archetypeId] ?? 'vanguard');
}
