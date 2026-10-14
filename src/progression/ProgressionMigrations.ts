import { PROFILE_SCHEMA_VERSION } from './ProgressionTypes';

/** Migrate only the profile payload; validation and defaults remain in ProfileService. */
export function migrateProgressionData(raw: unknown): unknown | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  let version = typeof source.profileSchemaVersion === 'number' ? Math.floor(source.profileSchemaVersion) : 1;
  if (version > PROFILE_SCHEMA_VERSION || version < 1) return null;
  const migrated: Record<string, unknown> = { ...source };
  while (version < PROFILE_SCHEMA_VERSION) {
    if (version === 1) {
      migrated.transactions = Array.isArray(migrated.transactions) ? migrated.transactions : [];
      version = 2;
      migrated.profileSchemaVersion = version;
    }
    if (version === 2) {
      // No invented historical equipment data; normalization supplies zero counters.
      version = 3;
      migrated.profileSchemaVersion = version;
    }
    if (version === 3) {
      // Campaign defaults are added by normalization; existing career/preferences are retained.
      version = 4;
      migrated.profileSchemaVersion = version;
    }
  }
  return migrated;
}
