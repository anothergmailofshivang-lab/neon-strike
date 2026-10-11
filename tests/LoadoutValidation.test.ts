import { describe, expect, it } from 'vitest';
import { createWeaponCatalog } from '../src/weapons/WeaponDefinitions';
import { WeaponSkinRegistry } from '../src/cosmetics/WeaponSkinRegistry';
import { WEAPON_SKIN_DEFINITIONS } from '../src/cosmetics/WeaponSkinDefinitions';
import { LoadoutManager } from '../src/loadouts/LoadoutManager';

describe('loadout and weapon skin validation', () => {
  it('validates primary/secondary slots and preserves cosmetic-only skin choices', () => {
    const skins = new WeaponSkinRegistry(WEAPON_SKIN_DEFINITIONS);
    const manager = new LoadoutManager(createWeaponCatalog(), skins);
    const loadout = manager.setLoadout({ primaryWeaponId: 'sniper-rifle', secondaryWeaponId: 'pistol', primarySkinId: 'arctic', secondarySkinId: 'dark-carbon' });
    expect(loadout.primaryWeaponId).toBe('sniper-rifle');
    expect(loadout.secondarySkinId).toBe('dark-carbon');
    expect(() => manager.setPrimaryWeapon('pistol')).toThrow(/primary weapon/);
    expect(() => manager.setSecondaryWeapon('assault-rifle')).toThrow(/secondary weapon/);
  });

  it('rejects unknown skin IDs and keeps all catalog weapons available for practice cycling', () => {
    const skins = new WeaponSkinRegistry(WEAPON_SKIN_DEFINITIONS);
    const manager = new LoadoutManager(createWeaponCatalog(), skins);
    expect(manager.weaponCatalog).toHaveLength(7);
    expect(() => manager.setPrimarySkin('missing-skin')).toThrow(/Unknown weapon skin/);
  });
});
