export type RewardCategory = 'weapon-skin' | 'title' | 'badge';

export interface RewardDefinition {
  id: string;
  displayName: string;
  description: string;
  category: RewardCategory;
  unlockSource: string;
  weaponSkinId?: string;
  compatibleWeaponIds?: readonly string[];
}

export const REWARD_DEFINITIONS: readonly RewardDefinition[] = [
  { id: 'title:signal-restored', displayName: 'Signal Restored', description: 'Complete the Carrier Zero campaign.', category: 'title', unlockSource: 'Carrier Zero campaign completion' },
  { id: 'badge:rookie', displayName: 'Rookie Signal', description: 'A profile badge for a new operative.', category: 'badge', unlockSource: 'Starter inventory' },
  { id: 'title:field-operative', displayName: 'Field Operative', description: 'Complete your first match.', category: 'title', unlockSource: 'First match' },
  { id: 'title:combat-veteran', displayName: 'Combat Veteran', description: 'Reach 100 career eliminations.', category: 'title', unlockSource: 'Career milestone' },
  { id: 'title:objective-specialist', displayName: 'Objective Specialist', description: 'Capture 25 control points.', category: 'title', unlockSource: 'Objective milestone' },
  { id: 'weapon-skin:standard', displayName: 'Standard Issue', description: 'The dependable factory finish used by every armory.', category: 'weapon-skin', unlockSource: 'Starter inventory' },
  { id: 'weapon-skin:neon-circuit', displayName: 'Neon Circuit', description: 'Dark composite with bright cyan circuitry.', category: 'weapon-skin', unlockSource: 'Starter inventory' },
  { id: 'weapon-skin:sandstorm', displayName: 'Sandstorm', description: 'Warm ceramic and brass finish for depot operations.', category: 'weapon-skin', unlockSource: 'Starter inventory' },
  { id: 'weapon-skin:arctic', displayName: 'Arctic', description: 'Pale armor plating with a cool blue emitter.', category: 'weapon-skin', unlockSource: 'Starter inventory' },
  { id: 'weapon-skin:dark-carbon', displayName: 'Dark Carbon', description: 'Low-reflective carbon with restrained amber accents.', category: 'weapon-skin', unlockSource: 'Starter inventory' },
  { id: 'weapon-skin:signal-flare', displayName: 'Signal Flare', description: 'A high-visibility finish earned at player level 3.', category: 'weapon-skin', unlockSource: 'Player level 3', weaponSkinId: 'signal-flare' },
  { id: 'weapon-skin:ion-bloom', displayName: 'Ion Bloom', description: 'A reactive finish earned at player level 8.', category: 'weapon-skin', unlockSource: 'Player level 8', weaponSkinId: 'ion-bloom' },
  { id: 'weapon-skin:mastery-chrome', displayName: 'Mastery Chrome', description: 'A universal finish for reaching Specialist mastery.', category: 'weapon-skin', unlockSource: 'Weapon mastery', weaponSkinId: 'mastery-chrome' },
];

const rewardMap = new Map(REWARD_DEFINITIONS.map((reward) => [reward.id, reward]));

export function getRewardDefinition(id: string): RewardDefinition | null {
  return rewardMap.get(id) ?? null;
}

export function listRewardDefinitions(): readonly RewardDefinition[] {
  return REWARD_DEFINITIONS;
}

export function rewardIdForWeaponSkin(skinId: string): string {
  return `weapon-skin:${skinId}`;
}
