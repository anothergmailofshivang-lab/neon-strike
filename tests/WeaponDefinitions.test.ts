import { describe, expect, it } from 'vitest';
import { createWeaponCatalog, WEAPON_DEFINITIONS, validateWeaponDefinition } from '../src/weapons/WeaponDefinitions';

describe('WeaponDefinitions', () => {
  it('registers seven distinct validated weapons', () => {
    const catalog = createWeaponCatalog();
    expect(catalog.size).toBe(7);
    expect(new Set(WEAPON_DEFINITIONS.map((weapon) => weapon.id)).size).toBe(7);
    expect(catalog.get('shotgun')?.pellets?.count).toBe(10);
    expect(catalog.get('burst-rifle')?.burst?.shots).toBe(3);
  });

  it('rejects invalid firing-mode-specific configurations', () => {
    const shotgun = WEAPON_DEFINITIONS.find((weapon) => weapon.id === 'shotgun');
    expect(shotgun).toBeDefined();
    expect(() => validateWeaponDefinition({ ...shotgun!, pellets: undefined })).toThrow();

    const burst = WEAPON_DEFINITIONS.find((weapon) => weapon.id === 'burst-rifle');
    expect(() => validateWeaponDefinition({ ...burst!, burst: undefined })).toThrow();
  });
});
