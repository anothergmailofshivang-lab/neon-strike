import type { DifficultyConfig } from './NPCDifficulty';

export interface NPCMovementProfile {
  walkSpeed: number;
  combatSpeed: number;
  acceleration: number;
  turnSpeed: number;
  collisionRadius: number;
  standingHeight: number;
}

export interface NPCPerceptionProfile {
  sightRange: number;
  fieldOfView: number;
  reactionDelay: number;
}

export interface NPCArchetypeDefinition {
  id: 'scout' | 'rifleman' | 'heavy' | 'sniper' | 'flanker' | 'defender';
  displayName: string;
  description: string;
  health: number;
  weaponId: string;
  movement: NPCMovementProfile;
  perception: NPCPerceptionProfile;
  preferredRange: { minimum: number; maximum: number };
  aggression: number;
  coverPreference: number;
  flankPreference: number;
  retreatHealthRatio: number;
  decisionInterval: number;
  color: number;
  scale: number;
}

export const NPC_ARCHETYPES: readonly NPCArchetypeDefinition[] = [
  {
    id: 'scout', displayName: 'Scout', description: 'Fast close-range pressure unit.', health: 70, weaponId: 'submachine-gun',
    movement: { walkSpeed: 5.8, combatSpeed: 7.2, acceleration: 28, turnSpeed: 6, collisionRadius: 0.38, standingHeight: 1.8 },
    perception: { sightRange: 38, fieldOfView: Math.PI * 0.7, reactionDelay: 0.25 }, preferredRange: { minimum: 5, maximum: 17 },
    aggression: 1.2, coverPreference: 0.55, flankPreference: 0.8, retreatHealthRatio: 0.2, decisionInterval: 0.22, color: 0xff664d, scale: 0.9,
  },
  {
    id: 'rifleman', displayName: 'Rifleman', description: 'Balanced medium-range combatant.', health: 100, weaponId: 'assault-rifle',
    movement: { walkSpeed: 4.4, combatSpeed: 5.2, acceleration: 23, turnSpeed: 4.5, collisionRadius: 0.42, standingHeight: 1.9 },
    perception: { sightRange: 48, fieldOfView: Math.PI * 0.66, reactionDelay: 0.3 }, preferredRange: { minimum: 14, maximum: 34 },
    aggression: 1, coverPreference: 0.95, flankPreference: 0.35, retreatHealthRatio: 0.18, decisionInterval: 0.28, color: 0x5fc7ff, scale: 1,
  },
  {
    id: 'heavy', displayName: 'Heavy', description: 'Durable pressure unit with deliberate movement.', health: 220, weaponId: 'energy-rifle',
    movement: { walkSpeed: 2.8, combatSpeed: 3.4, acceleration: 13, turnSpeed: 2.5, collisionRadius: 0.52, standingHeight: 2.15 },
    perception: { sightRange: 42, fieldOfView: Math.PI * 0.62, reactionDelay: 0.42 }, preferredRange: { minimum: 10, maximum: 28 },
    aggression: 1.05, coverPreference: 1.1, flankPreference: 0.1, retreatHealthRatio: 0.12, decisionInterval: 0.38, color: 0xffa742, scale: 1.2,
  },
  {
    id: 'sniper', displayName: 'Sniper', description: 'Long-range precision threat.', health: 85, weaponId: 'sniper-rifle',
    movement: { walkSpeed: 3.2, combatSpeed: 3.5, acceleration: 15, turnSpeed: 3, collisionRadius: 0.4, standingHeight: 1.95 },
    perception: { sightRange: 75, fieldOfView: Math.PI * 0.58, reactionDelay: 0.7 }, preferredRange: { minimum: 34, maximum: 70 },
    aggression: 0.65, coverPreference: 1.3, flankPreference: 0.25, retreatHealthRatio: 0.3, decisionInterval: 0.42, color: 0xb48cff, scale: 1,
  },
  {
    id: 'flanker', displayName: 'Flanker', description: 'Mobile alternate-route attacker.', health: 90, weaponId: 'burst-rifle',
    movement: { walkSpeed: 4.8, combatSpeed: 6, acceleration: 24, turnSpeed: 5, collisionRadius: 0.4, standingHeight: 1.85 },
    perception: { sightRange: 44, fieldOfView: Math.PI * 0.65, reactionDelay: 0.3 }, preferredRange: { minimum: 10, maximum: 25 },
    aggression: 1.05, coverPreference: 0.7, flankPreference: 1.4, retreatHealthRatio: 0.22, decisionInterval: 0.25, color: 0x9dff67, scale: 0.95,
  },
  {
    id: 'defender', displayName: 'Defender', description: 'Region-holding arena guard.', health: 115, weaponId: 'assault-rifle',
    movement: { walkSpeed: 3.6, combatSpeed: 4, acceleration: 18, turnSpeed: 3.5, collisionRadius: 0.43, standingHeight: 1.9 },
    perception: { sightRange: 50, fieldOfView: Math.PI * 0.65, reactionDelay: 0.34 }, preferredRange: { minimum: 16, maximum: 38 },
    aggression: 0.8, coverPreference: 1.45, flankPreference: 0.15, retreatHealthRatio: 0.2, decisionInterval: 0.35, color: 0xffd35c, scale: 1.05,
  },
];

export function getNPCArchetype(id: NPCArchetypeDefinition['id']): NPCArchetypeDefinition {
  const definition = NPC_ARCHETYPES.find((entry) => entry.id === id);
  if (!definition) {
    throw new Error(`Unknown NPC archetype: ${id}`);
  }
  return definition;
}

export function validateNPCArchetype(definition: NPCArchetypeDefinition): NPCArchetypeDefinition {
  if (!definition.id || !definition.weaponId || definition.health <= 0 || definition.movement.walkSpeed <= 0) {
    throw new Error(`Invalid NPC archetype definition: ${definition.id}`);
  }
  if (definition.perception.sightRange <= 0 || definition.perception.fieldOfView <= 0 || definition.preferredRange.minimum < 0) {
    throw new Error(`Invalid NPC perception or range configuration: ${definition.id}`);
  }
  return definition;
}

export function difficultyAdjustedPerception(definition: NPCArchetypeDefinition, difficulty: DifficultyConfig): NPCPerceptionProfile {
  return {
    sightRange: definition.perception.sightRange * difficulty.perceptionRangeMultiplier,
    fieldOfView: definition.perception.fieldOfView,
    reactionDelay: definition.perception.reactionDelay + difficulty.reactionDelay,
  };
}
