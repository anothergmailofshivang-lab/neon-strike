import type { WeaponDefinition } from '../weapons/WeaponTypes';

export interface WeaponSkinDefinition {
  id: string;
  displayName: string;
  description: string;
  compatibleWeaponIds?: readonly string[];
  primaryColor: number;
  secondaryColor: number;
  energyColor: number;
  roughness: number;
  metalness: number;
}

export const WEAPON_SKIN_DEFINITIONS: readonly WeaponSkinDefinition[] = [
  { id: 'standard', displayName: 'Standard Issue', description: 'Factory finish used by the range armory.', primaryColor: 0x1d415c, secondaryColor: 0x91efff, energyColor: 0x00d8ff, roughness: 0.35, metalness: 0.7 },
  { id: 'neon-circuit', displayName: 'Neon Circuit', description: 'Dark composite with bright cyan circuitry.', primaryColor: 0x142531, secondaryColor: 0x5ef3ff, energyColor: 0x00ffff, roughness: 0.28, metalness: 0.8 },
  { id: 'sandstorm', displayName: 'Sandstorm', description: 'Warm ceramic and brass finish for depot operations.', primaryColor: 0x79563b, secondaryColor: 0xe4ae67, energyColor: 0xff7a36, roughness: 0.5, metalness: 0.5 },
  { id: 'arctic', displayName: 'Arctic', description: 'Pale armor plating with a cool blue emitter.', primaryColor: 0xb5d1da, secondaryColor: 0x537b9c, energyColor: 0x8ce9ff, roughness: 0.3, metalness: 0.65 },
  { id: 'dark-carbon', displayName: 'Dark Carbon', description: 'Low-reflective carbon with restrained amber accents.', primaryColor: 0x141a22, secondaryColor: 0x4d5d6c, energyColor: 0xff9f42, roughness: 0.62, metalness: 0.55 },
];

export function validateWeaponSkin(skin: WeaponSkinDefinition): WeaponSkinDefinition {
  if (!skin.id.trim() || !skin.displayName.trim()) throw new Error('Weapon skins require a stable ID and display name.');
  if (![skin.roughness, skin.metalness].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) throw new Error(`Invalid material values for weapon skin ${skin.id}.`);
  if (![skin.primaryColor, skin.secondaryColor, skin.energyColor].every((value) => Number.isInteger(value) && value >= 0 && value <= 0xffffff)) throw new Error(`Invalid colors for weapon skin ${skin.id}.`);
  return skin;
}

export function isSkinCompatible(skin: WeaponSkinDefinition, weapon: WeaponDefinition): boolean {
  return !skin.compatibleWeaponIds || skin.compatibleWeaponIds.includes(weapon.id);
}
