import type { WeaponDefinition } from './WeaponTypes';

export const WEAPON_DEFINITIONS: readonly WeaponDefinition[] = [
  {
    id: 'assault-rifle',
    displayName: 'A-17 Pulse Rifle',
    category: 'primary',
    description: 'A balanced automatic rifle for controlled mid-range fire.',
    firingMode: 'automatic',
    baseDamage: 18,
    fireInterval: 0.1,
    magazineCapacity: 30,
    startingReserveAmmo: 120,
    maximumReserveAmmo: 180,
    reloadDuration: 1.8,
    range: 100,
    spread: { base: 0.008, movingMultiplier: 1.8, sustainedPerShot: 0.0012, maximum: 0.045, recovery: 0.06 },
    recoil: { vertical: 0.018, horizontal: 0.007, recovery: 8, maximumAccumulation: 0.12 },
    criticalHitMultiplier: 1.75,
    damageFalloff: { startDistance: 35, endDistance: 100, minimumMultiplier: 0.65 },
    aimDownSights: { supported: true, fovMultiplier: 0.82, spreadMultiplier: 0.55, sensitivityMultiplier: 0.85 },
    visual: { primaryColor: 0x1d415c, secondaryColor: 0x91efff, energyColor: 0x00d8ff, scale: 1 },
  },
  {
    id: 'submachine-gun',
    displayName: 'VX-9 Sting',
    category: 'primary',
    description: 'A compact automatic weapon built for close-range pressure.',
    firingMode: 'automatic',
    baseDamage: 11,
    fireInterval: 0.06,
    magazineCapacity: 36,
    startingReserveAmmo: 144,
    maximumReserveAmmo: 216,
    reloadDuration: 1.5,
    range: 65,
    spread: { base: 0.018, movingMultiplier: 1.5, sustainedPerShot: 0.0018, maximum: 0.075, recovery: 0.09 },
    recoil: { vertical: 0.012, horizontal: 0.01, recovery: 10, maximumAccumulation: 0.14 },
    criticalHitMultiplier: 1.6,
    damageFalloff: { startDistance: 18, endDistance: 65, minimumMultiplier: 0.5 },
    aimDownSights: { supported: false, fovMultiplier: 1, spreadMultiplier: 1, sensitivityMultiplier: 1 },
    visual: { primaryColor: 0x34313f, secondaryColor: 0xff8a54, energyColor: 0xff602e, scale: 0.85 },
  },
  {
    id: 'shotgun',
    displayName: 'BR-8 Scattercaster',
    category: 'primary',
    description: 'A heavy close-range scatter weapon that fires multiple pellets.',
    firingMode: 'pellet',
    baseDamage: 9,
    fireInterval: 0.8,
    magazineCapacity: 8,
    startingReserveAmmo: 48,
    maximumReserveAmmo: 80,
    reloadDuration: 2.2,
    range: 35,
    spread: { base: 0.045, movingMultiplier: 1.25, sustainedPerShot: 0, maximum: 0.12, recovery: 0.2 },
    recoil: { vertical: 0.09, horizontal: 0.025, recovery: 5, maximumAccumulation: 0.2 },
    criticalHitMultiplier: 1.35,
    damageFalloff: { startDistance: 12, endDistance: 35, minimumMultiplier: 0.3 },
    aimDownSights: { supported: false, fovMultiplier: 1, spreadMultiplier: 1, sensitivityMultiplier: 1 },
    pellets: { count: 10, spreadMultiplier: 1 },
    visual: { primaryColor: 0x4b332e, secondaryColor: 0xffba73, energyColor: 0xff7d35, scale: 1.15 },
  },
  {
    id: 'sniper-rifle',
    displayName: 'L-90 Longwatch',
    category: 'primary',
    description: 'A precise long-range rifle with a slow, high-impact firing cycle.',
    firingMode: 'semiautomatic',
    baseDamage: 90,
    fireInterval: 1.1,
    magazineCapacity: 5,
    startingReserveAmmo: 25,
    maximumReserveAmmo: 40,
    reloadDuration: 2.4,
    range: 180,
    spread: { base: 0.001, movingMultiplier: 5, sustainedPerShot: 0, maximum: 0.02, recovery: 0.12 },
    recoil: { vertical: 0.11, horizontal: 0.015, recovery: 4, maximumAccumulation: 0.22 },
    criticalHitMultiplier: 2.2,
    damageFalloff: { startDistance: 100, endDistance: 180, minimumMultiplier: 0.85 },
    aimDownSights: { supported: true, fovMultiplier: 0.45, spreadMultiplier: 0.15, sensitivityMultiplier: 0.55 },
    visual: { primaryColor: 0x172a49, secondaryColor: 0xb7d9ff, energyColor: 0x75aaff, scale: 1.25 },
  },
  {
    id: 'pistol',
    displayName: 'K-4 Sidekick',
    category: 'secondary',
    description: 'A responsive semiautomatic sidearm with dependable handling.',
    firingMode: 'semiautomatic',
    baseDamage: 24,
    fireInterval: 0.25,
    magazineCapacity: 12,
    startingReserveAmmo: 72,
    maximumReserveAmmo: 120,
    reloadDuration: 1.25,
    range: 80,
    spread: { base: 0.008, movingMultiplier: 1.5, sustainedPerShot: 0, maximum: 0.03, recovery: 0.08 },
    recoil: { vertical: 0.028, horizontal: 0.01, recovery: 8, maximumAccumulation: 0.1 },
    criticalHitMultiplier: 1.8,
    damageFalloff: { startDistance: 30, endDistance: 80, minimumMultiplier: 0.6 },
    aimDownSights: { supported: true, fovMultiplier: 0.9, spreadMultiplier: 0.65, sensitivityMultiplier: 0.9 },
    visual: { primaryColor: 0x2d3540, secondaryColor: 0xd2e6ef, energyColor: 0x9eefff, scale: 0.7 },
  },
  {
    id: 'burst-rifle',
    displayName: 'BR-3 Triad',
    category: 'primary',
    description: 'A disciplined three-round burst platform for mid-range precision.',
    firingMode: 'burst',
    baseDamage: 16,
    fireInterval: 0.42,
    magazineCapacity: 24,
    startingReserveAmmo: 96,
    maximumReserveAmmo: 144,
    reloadDuration: 1.9,
    range: 110,
    spread: { base: 0.006, movingMultiplier: 1.8, sustainedPerShot: 0.001, maximum: 0.035, recovery: 0.07 },
    recoil: { vertical: 0.022, horizontal: 0.006, recovery: 8, maximumAccumulation: 0.13 },
    criticalHitMultiplier: 1.85,
    damageFalloff: { startDistance: 45, endDistance: 110, minimumMultiplier: 0.68 },
    aimDownSights: { supported: true, fovMultiplier: 0.8, spreadMultiplier: 0.5, sensitivityMultiplier: 0.8 },
    burst: { shots: 3, shotInterval: 0.07, recovery: 0.42 },
    visual: { primaryColor: 0x303d26, secondaryColor: 0xc7ec8e, energyColor: 0x9be64c, scale: 1 },
  },
  {
    id: 'energy-rifle',
    displayName: 'E-77 Arc Lance',
    category: 'primary',
    description: 'A slow, luminous pulse rifle with stable energy bolts.',
    firingMode: 'energy',
    baseDamage: 30,
    fireInterval: 0.22,
    magazineCapacity: 20,
    startingReserveAmmo: 80,
    maximumReserveAmmo: 120,
    reloadDuration: 1.7,
    range: 120,
    spread: { base: 0.006, movingMultiplier: 1.6, sustainedPerShot: 0, maximum: 0.02, recovery: 0.1 },
    recoil: { vertical: 0.03, horizontal: 0.004, recovery: 7, maximumAccumulation: 0.12 },
    criticalHitMultiplier: 1.7,
    damageFalloff: { startDistance: 60, endDistance: 120, minimumMultiplier: 0.75 },
    aimDownSights: { supported: true, fovMultiplier: 0.8, spreadMultiplier: 0.45, sensitivityMultiplier: 0.8 },
    visual: { primaryColor: 0x203e42, secondaryColor: 0xc9ffff, energyColor: 0x00fff0, scale: 1.05 },
  },
];

export function validateWeaponDefinition(definition: WeaponDefinition): WeaponDefinition {
  if (!definition.id.trim() || !definition.displayName.trim()) {
    throw new Error('Weapon definitions require non-empty IDs and display names.');
  }
  const positive: Array<[number, string]> = [
    [definition.baseDamage, 'baseDamage'],
    [definition.fireInterval, 'fireInterval'],
    [definition.magazineCapacity, 'magazineCapacity'],
    [definition.reloadDuration, 'reloadDuration'],
    [definition.range, 'range'],
    [definition.criticalHitMultiplier, 'criticalHitMultiplier'],
  ];
  for (const [value, field] of positive) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${definition.id}.${field} must be finite and greater than zero.`);
    }
  }
  if (!Number.isInteger(definition.magazineCapacity) || definition.startingReserveAmmo < 0 || definition.maximumReserveAmmo < definition.startingReserveAmmo) {
    throw new Error(`${definition.id} has invalid ammunition configuration.`);
  }
  if (definition.spread.base < 0 || definition.spread.maximum < definition.spread.base || definition.spread.movingMultiplier < 0) {
    throw new Error(`${definition.id} has invalid spread configuration.`);
  }
  if (definition.firingMode === 'burst') {
    if (!definition.burst || !Number.isInteger(definition.burst.shots) || definition.burst.shots <= 0 || definition.burst.shotInterval <= 0) {
      throw new Error(`${definition.id} requires a valid burst configuration.`);
    }
  }
  if (definition.firingMode === 'pellet') {
    if (!definition.pellets || !Number.isInteger(definition.pellets.count) || definition.pellets.count <= 0) {
      throw new Error(`${definition.id} requires a valid pellet configuration.`);
    }
  }
  return definition;
}

export function createWeaponCatalog(definitions: readonly WeaponDefinition[] = WEAPON_DEFINITIONS): ReadonlyMap<string, WeaponDefinition> {
  const catalog = new Map<string, WeaponDefinition>();
  for (const definition of definitions) {
    validateWeaponDefinition(definition);
    if (catalog.has(definition.id)) {
      throw new Error(`Duplicate weapon definition ID: ${definition.id}`);
    }
    catalog.set(definition.id, definition);
  }
  return catalog;
}

export function getWeaponDefinition(id: string): WeaponDefinition {
  const definition = WEAPON_DEFINITIONS.find((entry) => entry.id === id);
  if (!definition) {
    throw new Error(`Unknown weapon definition: ${id}`);
  }
  return definition;
}
