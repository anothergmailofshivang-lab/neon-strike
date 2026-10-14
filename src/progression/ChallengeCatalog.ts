import type { GameModeId } from '../match/MatchTypes';

export type ChallengeMetric = 'match' | 'win' | 'eliminations' | 'damage' | 'objective-captures' | 'survival-rounds' | 'weapon-eliminations' | 'explosive-eliminations';

export interface ChallengeDefinition {
  id: string;
  name: string;
  description: string;
  period: 'daily' | 'weekly' | 'permanent';
  metric: ChallengeMetric;
  target: number;
  xpReward: number;
  modeIds?: readonly GameModeId[];
  weaponCategory?: string;
  weaponId?: string;
}

export const CHALLENGE_DEFINITIONS: readonly ChallengeDefinition[] = [
  { id: 'permanent-blast-drill', name: 'Blast Drill', description: 'Eliminate five hostile NPCs with frag grenades in completed matches.', period: 'permanent', metric: 'explosive-eliminations', target: 5, xpReward: 125 },
  { id: 'daily-deployment', name: 'Daily Deployment', description: 'Complete one non-practice match.', period: 'daily', metric: 'match', target: 1, xpReward: 100, modeIds: ['free-for-all', 'team-deathmatch', 'domination', 'survival'] },
  { id: 'daily-eliminations', name: 'Daily Sweep', description: 'Earn five verified eliminations.', period: 'daily', metric: 'eliminations', target: 5, xpReward: 125 },
  { id: 'daily-damage', name: 'Daily Pressure', description: 'Deal 1,000 attributed damage.', period: 'daily', metric: 'damage', target: 1000, xpReward: 125 },
  { id: 'daily-objective', name: 'Point Runner', description: 'Capture two control points.', period: 'daily', metric: 'objective-captures', target: 2, xpReward: 150, modeIds: ['domination'] },
  { id: 'daily-rifle', name: 'Rifle Protocol', description: 'Earn three eliminations with a primary rifle.', period: 'daily', metric: 'weapon-eliminations', target: 3, xpReward: 150, weaponCategory: 'primary' },
  { id: 'daily-sniper', name: 'Longwatch', description: 'Earn two eliminations with the sniper rifle.', period: 'daily', metric: 'weapon-eliminations', target: 2, xpReward: 175, weaponId: 'sniper-rifle' },
  { id: 'weekly-operator', name: 'Weekly Operator', description: 'Complete five non-practice matches.', period: 'weekly', metric: 'match', target: 5, xpReward: 350, modeIds: ['free-for-all', 'team-deathmatch', 'domination', 'survival'] },
  { id: 'weekly-victory', name: 'Victory Circuit', description: 'Win three completed matches.', period: 'weekly', metric: 'win', target: 3, xpReward: 400 },
  { id: 'weekly-eliminations', name: 'Hostile Shutdown', description: 'Earn 25 verified eliminations.', period: 'weekly', metric: 'eliminations', target: 25, xpReward: 400 },
  { id: 'weekly-objective', name: 'Control Network', description: 'Capture ten control points.', period: 'weekly', metric: 'objective-captures', target: 10, xpReward: 450, modeIds: ['domination'] },
  { id: 'weekly-survival', name: 'Endurance Run', description: 'Complete five survival rounds.', period: 'weekly', metric: 'survival-rounds', target: 5, xpReward: 450, modeIds: ['survival'] },
  { id: 'permanent-first-class', name: 'First Class', description: 'Complete four non-practice matches.', period: 'permanent', metric: 'match', target: 4, xpReward: 300 },
];

const challengeMap = new Map(CHALLENGE_DEFINITIONS.map((challenge) => [challenge.id, challenge]));

export function getChallengeDefinition(id: string): ChallengeDefinition | null {
  return challengeMap.get(id) ?? null;
}

export function listChallengeDefinitions(): readonly ChallengeDefinition[] {
  return CHALLENGE_DEFINITIONS;
}
