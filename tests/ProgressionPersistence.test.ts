import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAYER_LOADOUT } from '../src/loadouts/LoadoutDefinitions';
import { ProgressionSaveManager } from '../src/persistence/ProgressionSaveManager';
import type { StorageLike } from '../src/persistence/SaveManager';
import { PROFILE_SCHEMA_VERSION } from '../src/progression/ProgressionTypes';
import { createDefaultProfile } from '../src/progression/ProfileService';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  public getItem(key: string): string | null { return this.values.get(key) ?? null; }
  public setItem(key: string, value: string): void { this.values.set(key, value); }
  public removeItem(key: string): void { this.values.delete(key); }
}

describe('progression persistence', () => {
  it('writes a versioned profile and migrates the previous profile shape', () => {
    const storage = new MemoryStorage();
    const manager = new ProgressionSaveManager(storage);
    const profile = createDefaultProfile(DEFAULT_PLAYER_LOADOUT, 'PERSISTED');

    expect(manager.save(profile)).toBe(true);
    expect((manager.load(DEFAULT_PLAYER_LOADOUT) as { profileSchemaVersion: number }).profileSchemaVersion).toBe(PROFILE_SCHEMA_VERSION);

    storage.setItem('neon-strike.player-profile', JSON.stringify({ profileSchemaVersion: 1, lifetimeXp: 25 }));
    const migrated = manager.load(DEFAULT_PLAYER_LOADOUT) as { profileSchemaVersion: number; lifetimeXp: number; transactions: unknown[] };
    expect(migrated.profileSchemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(migrated.lifetimeXp).toBe(25);
    expect(migrated.transactions).toEqual([]);
  });

  it('falls back to the last good copy after malformed primary data', () => {
    const storage = new MemoryStorage();
    const manager = new ProgressionSaveManager(storage);
    const first = createDefaultProfile(DEFAULT_PLAYER_LOADOUT, 'FIRST');
    const second = { ...first, displayName: 'SECOND' };
    manager.save(first);
    manager.save(second);
    storage.setItem('neon-strike.player-profile', '{malformed');

    const recovered = manager.load(DEFAULT_PLAYER_LOADOUT) as { displayName: string };
    expect(recovered.displayName).toBe('FIRST');
  });
});
