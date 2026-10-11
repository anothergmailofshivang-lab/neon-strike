import { describe, expect, it } from 'vitest';
import { getWeaponDefinition } from '../src/weapons/WeaponDefinitions';
import { createWeaponModel, disposeWeaponModel } from '../src/weapons/WeaponModelFactory';
import { WEAPON_SKIN_DEFINITIONS } from '../src/cosmetics/WeaponSkinDefinitions';
import { applyWeaponSkin } from '../src/cosmetics/WeaponSkinApplicator';

describe('weapon skin application', () => {
  it('updates presentation materials without changing weapon statistics', () => {
    const weapon = getWeaponDefinition('assault-rifle');
    const skin = WEAPON_SKIN_DEFINITIONS.find((entry) => entry.id === 'neon-circuit');
    if (!skin) throw new Error('test skin missing');
    const model = createWeaponModel(weapon);
    const baseDamage = weapon.baseDamage;
    applyWeaponSkin(model, weapon, skin);

    expect(model.group.userData.skinId).toBe('neon-circuit');
    expect(model.materials.body.color.getHex()).toBe(skin.primaryColor);
    expect(weapon.baseDamage).toBe(baseDamage);
    disposeWeaponModel(model);
  });
});
