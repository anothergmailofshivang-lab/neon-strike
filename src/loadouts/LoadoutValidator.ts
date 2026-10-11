import type { WeaponSkinRegistry } from '../cosmetics/WeaponSkinRegistry';
import { isSkinCompatible } from '../cosmetics/WeaponSkinDefinitions';
import type { WeaponDefinition } from '../weapons/WeaponTypes';
import type { PlayerLoadout } from './LoadoutTypes';

export function validateLoadout(loadout: PlayerLoadout, catalog: ReadonlyMap<string, WeaponDefinition>, skins: WeaponSkinRegistry): PlayerLoadout {
  const primary = catalog.get(loadout.primaryWeaponId);
  const secondary = catalog.get(loadout.secondaryWeaponId);
  if (!primary || primary.category !== 'primary') throw new Error(`Invalid primary weapon: ${loadout.primaryWeaponId}`);
  if (!secondary || secondary.category !== 'secondary') throw new Error(`Invalid secondary weapon: ${loadout.secondaryWeaponId}`);
  if (loadout.primaryWeaponId === loadout.secondaryWeaponId) throw new Error('Primary and secondary weapons must be different.');
  const primarySkin = skins.get(loadout.primarySkinId);
  const secondarySkin = skins.get(loadout.secondarySkinId);
  if (!isSkinCompatible(primarySkin, primary)) throw new Error(`Skin ${primarySkin.id} is incompatible with ${primary.id}.`);
  if (!isSkinCompatible(secondarySkin, secondary)) throw new Error(`Skin ${secondarySkin.id} is incompatible with ${secondary.id}.`);
  return { ...loadout };
}
