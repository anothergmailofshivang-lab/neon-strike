import type { EquipmentDefinition } from './EquipmentTypes';

export const DEFAULT_TACTICAL_EQUIPMENT_ID = 'frag-grenade';
export const DEFAULT_UTILITY_EQUIPMENT_ID = 'med-kit';

export const EQUIPMENT_DEFINITIONS: readonly EquipmentDefinition[] = [
  {
    id: 'frag-grenade', displayName: 'FRAG GRENADE', description: 'Timed explosive with distance falloff and world-aware blast exposure.',
    slot: 'tactical', kind: 'frag', startingCharges: 2, maximumCharges: 2, cooldownSeconds: 0.35, fuseSeconds: 1.4, lifetimeSeconds: 8,
    radius: 4.5, damage: 95, effectAmount: 0, effectColor: 0xff8b54, bounceDamping: 0.48, npcUsable: true,
  },
  {
    id: 'smoke-grenade', displayName: 'SMOKE GRENADE', description: 'Creates a bounded visibility field that disrupts NPC line of sight.',
    slot: 'tactical', kind: 'smoke', startingCharges: 2, maximumCharges: 2, cooldownSeconds: 0.35, fuseSeconds: 0.7, lifetimeSeconds: 10,
    radius: 5.5, damage: 0, effectAmount: 8, effectColor: 0x9da9b7, bounceDamping: 0.42, npcUsable: true,
  },
  {
    id: 'flash-device', displayName: 'FLASH DEVICE', description: 'Briefly disorients actors caught in the exposed blast area.',
    slot: 'tactical', kind: 'flash', startingCharges: 1, maximumCharges: 1, cooldownSeconds: 0.35, fuseSeconds: 0.8, lifetimeSeconds: 8,
    radius: 6, damage: 0, effectAmount: 2.2, effectColor: 0xdffbff, bounceDamping: 0.4, npcUsable: false,
  },
  {
    id: 'med-kit', displayName: 'FIELD RECOVERY', description: 'Restores a bounded amount of health when the player is injured.',
    slot: 'utility', kind: 'med-kit', startingCharges: 1, maximumCharges: 1, cooldownSeconds: 1.2, fuseSeconds: 0, lifetimeSeconds: 0,
    radius: 0, damage: 0, effectAmount: 38, effectColor: 0x73ffb0, bounceDamping: 0, npcUsable: false,
  },
  {
    id: 'ammo-pack', displayName: 'AMMO PACK', description: 'Restores reserve ammunition according to the active weapon definitions.',
    slot: 'utility', kind: 'ammo-pack', startingCharges: 1, maximumCharges: 1, cooldownSeconds: 1.2, fuseSeconds: 0, lifetimeSeconds: 0,
    radius: 0, damage: 0, effectAmount: 35, effectColor: 0x71f4ff, bounceDamping: 0, npcUsable: false,
  },
  {
    id: 'sensor-pulse', displayName: 'SENSOR PULSE', description: 'Temporarily reveals nearby hostile NPCs on the existing minimap.',
    slot: 'utility', kind: 'sensor', startingCharges: 1, maximumCharges: 1, cooldownSeconds: 2, fuseSeconds: 0, lifetimeSeconds: 6,
    radius: 28, damage: 0, effectAmount: 6, effectColor: 0x91a7ff, bounceDamping: 0, npcUsable: false,
  },
];

const equipmentMap = new Map(EQUIPMENT_DEFINITIONS.map((definition) => [definition.id, definition]));

export function getEquipmentDefinition(id: string): EquipmentDefinition {
  const definition = equipmentMap.get(id);
  if (!definition) throw new Error(`Unknown equipment definition: ${id}`);
  return definition;
}

export function listEquipmentDefinitions(): readonly EquipmentDefinition[] {
  return EQUIPMENT_DEFINITIONS;
}

export function validateEquipmentDefinition(definition: EquipmentDefinition): EquipmentDefinition {
  if (!definition.id.trim() || !definition.displayName.trim()) throw new Error('Equipment requires a stable ID and display name.');
  if (!Number.isInteger(definition.startingCharges) || definition.startingCharges < 0 || definition.startingCharges > definition.maximumCharges) throw new Error(`Invalid charges for ${definition.id}.`);
  if (![definition.maximumCharges, definition.cooldownSeconds, definition.fuseSeconds, definition.lifetimeSeconds, definition.radius, definition.damage, definition.effectAmount, definition.bounceDamping].every((value) => Number.isFinite(value) && value >= 0)) throw new Error(`Invalid numeric values for ${definition.id}.`);
  if (definition.bounceDamping > 1) throw new Error(`Invalid bounce damping for ${definition.id}.`);
  if (definition.throwSpeed !== undefined && (!Number.isFinite(definition.throwSpeed) || definition.throwSpeed <= 0)) throw new Error(`Invalid throw speed for ${definition.id}.`);
  if (definition.gravity !== undefined && (!Number.isFinite(definition.gravity) || definition.gravity < 0)) throw new Error(`Invalid gravity for ${definition.id}.`);
  if (!Number.isInteger(definition.maximumCharges) || definition.maximumCharges > 10) throw new Error(`Invalid capacity for ${definition.id}.`);
  if (definition.slot === 'tactical' && (definition.fuseSeconds <= 0 || definition.lifetimeSeconds < definition.fuseSeconds)) throw new Error(`Invalid fuse for ${definition.id}.`);
  return definition;
}

/** Missing/obsolete saved equipment falls back without erasing the weapon loadout. */
export function normalizeEquipmentId(id: unknown, slot: 'tactical' | 'utility'): string {
  return typeof id === 'string' && equipmentMap.get(id)?.slot === slot ? id : slot === 'tactical' ? DEFAULT_TACTICAL_EQUIPMENT_ID : DEFAULT_UTILITY_EQUIPMENT_ID;
}

export function createEquipmentRegistry(definitions: readonly EquipmentDefinition[] = EQUIPMENT_DEFINITIONS): ReadonlyMap<string, EquipmentDefinition> {
  const registry = new Map<string, EquipmentDefinition>();
  for (const definition of definitions) {
    validateEquipmentDefinition(definition);
    if (registry.has(definition.id)) throw new Error(`Duplicate equipment ID: ${definition.id}`);
    registry.set(definition.id, definition);
  }
  return registry;
}
