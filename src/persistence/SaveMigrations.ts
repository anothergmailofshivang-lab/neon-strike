import { SAVE_SCHEMA_VERSION, type SavedPlayerPreferences } from './SaveSchema';

export function migrateSaveData(raw: unknown): SavedPlayerPreferences | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<SavedPlayerPreferences>;
  if (data.schemaVersion !== SAVE_SCHEMA_VERSION) return null;
  if (typeof data.characterId !== 'string' || !data.appearance || !data.loadout) return null;
  return { schemaVersion: SAVE_SCHEMA_VERSION, characterId: data.characterId, appearance: data.appearance, loadout: data.loadout };
}
