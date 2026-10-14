import type { PlayerLoadout } from '../loadouts/LoadoutTypes';
import type { PlayerProfile } from '../progression/ProgressionTypes';
import { normalizeProfile } from '../progression/ProfileService';
import { migrateProgressionData } from '../progression/ProgressionMigrations';
import type { StorageLike } from './SaveManager';

export const PROGRESSION_STORAGE_KEY = 'neon-strike.player-profile';
export const PROGRESSION_BACKUP_KEY = 'neon-strike.player-profile.backup';

interface StoredProgression {
  schemaVersion: number;
  profile: unknown;
}

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Local, recoverable persistence for the long-lived progression profile. */
export class ProgressionSaveManager {
  private readonly storage: StorageLike | null;

  public constructor(
    storage: StorageLike | null = browserStorage(),
    private readonly key = PROGRESSION_STORAGE_KEY,
    private readonly backupKey = PROGRESSION_BACKUP_KEY,
  ) {
    this.storage = storage;
  }

  public load(_fallbackLoadout: PlayerLoadout): unknown {
    if (!this.storage) return null;
    const primary = this.read(this.key);
    if (primary !== null) return primary;
    return this.read(this.backupKey);
  }

  public save(profile: PlayerProfile): boolean {
    if (!this.storage) return false;
    const value: StoredProgression = { schemaVersion: profile.profileSchemaVersion, profile };
    try {
      const encoded = JSON.stringify(value);
      const previous = this.storage.getItem(this.key);
      if (previous) this.storage.setItem(this.backupKey, previous);
      this.storage.setItem(this.key, encoded);
      return true;
    } catch {
      return false;
    }
  }

  public clear(): boolean {
    if (!this.storage?.removeItem) return false;
    try {
      this.storage.removeItem(this.key);
      this.storage.removeItem(this.backupKey);
      return true;
    } catch {
      return false;
    }
  }

  private read(key: string): unknown | null {
    try {
      const encoded = this.storage?.getItem(key);
      if (!encoded) return null;
      const raw = JSON.parse(encoded) as unknown;
      if (raw && typeof raw === 'object' && 'profile' in raw) return migrateProgressionData((raw as StoredProgression).profile);
      // Profiles written by the first Phase 7 draft were stored directly. Keep
      // accepting that shape so an upgrade never discards a valid career.
      return migrateProgressionData(raw);
    } catch {
      return null;
    }
  }
}

export function loadProgressionProfile(manager: ProgressionSaveManager, fallbackLoadout: PlayerLoadout): PlayerProfile | null {
  const raw = manager.load(fallbackLoadout);
  return raw === null ? null : normalizeProfile(raw, fallbackLoadout);
}
