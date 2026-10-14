export type AchievementMetric =
  | 'campaignMissions'
  | 'explosiveEliminations' | 'resourcesCollected' | 'propsDestroyed'
  | 'matchesPlayed'
  | 'matchesWon'
  | 'eliminations'
  | 'damageDealt'
  | 'criticalHits'
  | 'objectiveCaptures'
  | 'survivalRounds'
  | 'level'
  | 'mapsCompleted'
  | 'modesPlayed'
  | 'weaponsUsed'
  | 'masteredWeapons';

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: 'combat' | 'objective' | 'survival' | 'mastery' | 'career' | 'explorer';
  metric: AchievementMetric;
  target: number;
  xpReward: number;
  rewardId?: string;
  hidden?: boolean;
}

export const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[] = [
  { id: 'carrier-zero-complete', name: 'Signal Restored', description: 'Successfully extract from all ten Carrier Zero operations.', category: 'career', metric: 'campaignMissions', target: 10, xpReward: 500, rewardId: 'title:signal-restored' },
  { id: 'blast-confirmed', name: 'Blast Confirmed', description: 'Eliminate three hostile NPCs with frag grenades in completed matches.', category: 'combat', metric: 'explosiveEliminations', target: 3, xpReward: 100 },
  { id: 'field-supplies', name: 'Field Supplies', description: 'Collect ten useful resource pickups in completed matches.', category: 'career', metric: 'resourcesCollected', target: 10, xpReward: 75 },
  { id: 'breach-work', name: 'Breach Work', description: 'Destroy five designated props in completed matches.', category: 'combat', metric: 'propsDestroyed', target: 5, xpReward: 75 },
  { id: 'getting-started', name: 'Getting Started', description: 'Complete one genuine match.', category: 'career', metric: 'matchesPlayed', target: 1, xpReward: 50, rewardId: 'title:field-operative' },
  { id: 'first-victory', name: 'First Victory', description: 'Win a completed match.', category: 'career', metric: 'matchesWon', target: 1, xpReward: 75 },
  { id: 'first-blood', name: 'First Blood', description: 'Earn a verified elimination against a hostile NPC.', category: 'combat', metric: 'eliminations', target: 1, xpReward: 50 },
  { id: 'combat-veteran', name: 'Combat Veteran', description: 'Reach 100 career eliminations.', category: 'combat', metric: 'eliminations', target: 100, xpReward: 250, rewardId: 'title:combat-veteran' },
  { id: 'combat-regular', name: 'Combat Regular', description: 'Reach 25 career eliminations.', category: 'combat', metric: 'eliminations', target: 25, xpReward: 100 },
  { id: 'heavy-hitter', name: 'Heavy Hitter', description: 'Deal 10,000 attributed damage.', category: 'combat', metric: 'damageDealt', target: 10000, xpReward: 200 },
  { id: 'critical-line', name: 'Critical Line', description: 'Land 25 verified critical hits.', category: 'combat', metric: 'criticalHits', target: 25, xpReward: 125 },
  { id: 'capture-specialist', name: 'Capture Specialist', description: 'Capture 10 genuine control points.', category: 'objective', metric: 'objectiveCaptures', target: 10, xpReward: 150 },
  { id: 'area-controller', name: 'Area Controller', description: 'Capture 25 genuine control points.', category: 'objective', metric: 'objectiveCaptures', target: 25, xpReward: 250, rewardId: 'title:objective-specialist' },
  { id: 'survivor', name: 'Survivor', description: 'Complete a survival round.', category: 'survival', metric: 'survivalRounds', target: 1, xpReward: 75 },
  { id: 'wave-breaker', name: 'Wave Breaker', description: 'Complete 10 survival rounds.', category: 'survival', metric: 'survivalRounds', target: 10, xpReward: 200 },
  { id: 'veteran', name: 'Veteran', description: 'Reach player level 10.', category: 'career', metric: 'level', target: 10, xpReward: 300 },
  { id: 'level-five', name: 'Signal Strength', description: 'Reach player level 5.', category: 'career', metric: 'level', target: 5, xpReward: 150 },
  { id: 'field-regular', name: 'Field Regular', description: 'Complete 10 genuine matches.', category: 'career', metric: 'matchesPlayed', target: 10, xpReward: 200 },
  { id: 'career-operator', name: 'Career Operator', description: 'Complete 50 genuine matches.', category: 'career', metric: 'matchesPlayed', target: 50, xpReward: 400 },
  { id: 'map-familiarity', name: 'Map Familiarity', description: 'Complete matches on three different arenas.', category: 'explorer', metric: 'mapsCompleted', target: 3, xpReward: 125 },
  { id: 'map-collector', name: 'Map Collector', description: 'Complete matches on every arena currently in the catalog.', category: 'explorer', metric: 'mapsCompleted', target: 5, xpReward: 250 },
  { id: 'mode-hopper', name: 'Mode Hopper', description: 'Complete three different game modes.', category: 'explorer', metric: 'modesPlayed', target: 3, xpReward: 125 },
  { id: 'arsenal-explorer', name: 'Arsenal Explorer', description: 'Use three different weapons in completed matches.', category: 'mastery', metric: 'weaponsUsed', target: 3, xpReward: 125 },
  { id: 'diverse-arsenal', name: 'Diverse Arsenal', description: 'Use all seven weapons in completed matches.', category: 'mastery', metric: 'weaponsUsed', target: 7, xpReward: 300 },
  { id: 'weapon-apprentice', name: 'Weapon Apprentice', description: 'Reach Specialist mastery with one weapon.', category: 'mastery', metric: 'masteredWeapons', target: 1, xpReward: 150, rewardId: 'weapon-skin:mastery-chrome' },
  { id: 'weapon-collective', name: 'Weapon Collective', description: 'Reach Specialist mastery with three weapons.', category: 'mastery', metric: 'masteredWeapons', target: 3, xpReward: 300 },
  { id: 'damage-specialist', name: 'Damage Specialist', description: 'Deal 50,000 attributed damage.', category: 'combat', metric: 'damageDealt', target: 50000, xpReward: 400 },
  { id: 'precision-record', name: 'Precision Record', description: 'Land 100 verified critical hits.', category: 'combat', metric: 'criticalHits', target: 100, xpReward: 350 },
  { id: 'survival-veteran', name: 'Survival Veteran', description: 'Complete 25 survival rounds.', category: 'survival', metric: 'survivalRounds', target: 25, xpReward: 400 },
];

const achievementMap = new Map(ACHIEVEMENT_DEFINITIONS.map((achievement) => [achievement.id, achievement]));

export function getAchievementDefinition(id: string): AchievementDefinition | null {
  return achievementMap.get(id) ?? null;
}
