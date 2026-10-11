import type { CharacterAppearance } from '../characters/CharacterTypes';
import type { PlayerLoadout } from '../loadouts/LoadoutTypes';

export const SAVE_SCHEMA_VERSION = 1;
export const SAVE_STORAGE_KEY = 'neon-strike.player-preferences';

export interface SavedPlayerPreferences {
  schemaVersion: number;
  characterId: string;
  appearance: CharacterAppearance;
  loadout: PlayerLoadout;
}
