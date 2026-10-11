import type { WeaponModel } from '../weapons/WeaponModelFactory';
import type { WeaponDefinition } from '../weapons/WeaponTypes';
import { isSkinCompatible, validateWeaponSkin, type WeaponSkinDefinition } from './WeaponSkinDefinitions';

/** Only instance-owned presentation materials are touched. Runtime/catalog data is read-only. */
export function applyWeaponSkin(model: WeaponModel, weapon: WeaponDefinition, skin: WeaponSkinDefinition): void {
  validateWeaponSkin(skin);
  if (!isSkinCompatible(skin, weapon)) throw new Error(`Skin ${skin.id} is incompatible with ${weapon.id}.`);
  const standard = skin.id === 'standard';
  const colors = standard ? weapon.visual : skin;
  model.materials.body.color.setHex(colors.primaryColor);
  model.materials.detail.color.setHex(colors.secondaryColor);
  model.materials.energy.color.setHex(colors.energyColor);
  model.materials.energy.emissive.setHex(colors.energyColor);
  model.materials.flash.color.setHex(colors.energyColor);
  for (const [material, roughness, metalness] of [
    [model.materials.body, 0.35, 0.7],
    [model.materials.detail, 0.28, 0.55],
    [model.materials.energy, 0.2, 0.15],
  ] as const) {
    material.roughness = standard ? roughness : skin.roughness;
    material.metalness = standard ? metalness : skin.metalness;
  }
  model.group.userData.skinId = skin.id;
}
