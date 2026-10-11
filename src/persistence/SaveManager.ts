import type { CharacterRegistry } from '../characters/CharacterRegistry';
import { defaultAppearance, validateAppearance } from '../characters/CharacterCustomization';
import type { CharacterAppearance } from '../characters/CharacterTypes';
import type { LoadoutManager } from '../loadouts/LoadoutManager';
import type { PlayerLoadout } from '../loadouts/LoadoutTypes';
import { migrateSaveData } from './SaveMigrations';
import { SAVE_SCHEMA_VERSION, SAVE_STORAGE_KEY, type SavedPlayerPreferences } from './SaveSchema';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export class SaveManager {
  private readonly storage: StorageLike | null;

  public constructor(
    private readonly characters: CharacterRegistry,
    private readonly loadouts: LoadoutManager,
    storage: StorageLike | null = browserStorage(),
    private readonly key = SAVE_STORAGE_KEY,
  ) {
    this.storage = storage;
  }

  public load(defaultCharacterId = 'vanguard'): SavedPlayerPreferences {
    const definition = this.characters.get(defaultCharacterId);
    const defaults: SavedPlayerPreferences = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      characterId: definition.id,
      appearance: defaultAppearance(definition),
      loadout: this.loadouts.loadout,
    };
    if (!this.storage) return defaults;
    try {
      const encoded = this.storage.getItem(this.key);
      if (!encoded) return defaults;
      const migrated = migrateSaveData(JSON.parse(encoded));
      if (!migrated) return defaults;
      const character = this.characters.has(migrated.characterId) ? this.characters.get(migrated.characterId) : definition;
      let appearance: CharacterAppearance;
      try { appearance = validateAppearance(character, migrated.appearance); } catch { appearance = defaultAppearance(character); }
      let loadout: PlayerLoadout;
      try { loadout = this.loadouts.setLoadout(migrated.loadout); } catch { loadout = defaults.loadout; }
      return { schemaVersion: SAVE_SCHEMA_VERSION, characterId: character.id, appearance, loadout };
    } catch {
      return defaults;
    }
  }

  public save(preferences: Omit<SavedPlayerPreferences, 'schemaVersion'>): boolean {
    let validated: SavedPlayerPreferences;
    try {
      const definition = this.characters.get(preferences.characterId);
      const appearance = validateAppearance(definition, preferences.appearance);
      const loadout = this.loadouts.setLoadout(preferences.loadout);
      validated = { schemaVersion: SAVE_SCHEMA_VERSION, characterId: definition.id, appearance, loadout };
    } catch {
      return false;
    }
    const value: SavedPlayerPreferences = validated;
    if (!this.storage) return false;
    try {
      this.storage.setItem(this.key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  public clear(): boolean {
    if (!this.storage?.removeItem) return false;
    try { this.storage.removeItem(this.key); return true; } catch { return false; }
  }
}
