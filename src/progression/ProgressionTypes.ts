import type { GameModeId, MatchOutcome, MatchSnapshot } from '../match/MatchTypes';
import type { CampaignProgress, MissionResult } from '../campaign/CampaignTypes';

export const PROFILE_SCHEMA_VERSION = 4;
export const MAX_MATCH_HISTORY = 20;
export const MAX_PROGRESS_TRANSACTIONS = 100;

export interface CareerStatistics {
  equipmentUses: number;
  explosiveDamage: number;
  explosiveEliminations: number;
  resourcesCollected: number;
  propsDestroyed: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  matchesDrawn: number;
  eliminations: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  damageReceived: number;
  shotsFired: number;
  shotsHit: number;
  criticalHits: number;
  playTimeSeconds: number;
  objectiveCaptures: number;
  objectiveScore: number;
  survivalRounds: number;
  bestSurvivalRound: number;
  mapsCompleted: string[];
  modesPlayed: string[];
  weaponsUsed: string[];
}

export interface WeaponMasteryRecord {
  weaponId: string;
  masteryXp: number;
  eliminations: number;
  hits: number;
  shots: number;
  damage: number;
  matchesUsed: number;
  highestTier: number;
}

export interface AchievementProgress {
  progress: number;
  completedAt: string | null;
}

export interface ChallengeProgress {
  challengeId: string;
  periodKey: string;
  progress: number;
  completed: boolean;
  rewardGranted: boolean;
  completedAt: string | null;
}

export interface ChallengeState {
  dailyPeriod: string;
  daily: ChallengeProgress[];
  weeklyPeriod: string;
  weekly: ChallengeProgress[];
  permanent: ChallengeProgress[];
}

export interface ProgressTransaction {
  id: string;
  source: string;
  xp: number;
  timestamp: string;
  matchId?: string;
}

export interface MatchHistoryEntry {
  missionId?: string;
  matchId: string;
  timestamp: string;
  modeId: GameModeId;
  mapId: string;
  outcome: MatchOutcome;
  durationSeconds: number;
  score: Readonly<Record<string, number>>;
  eliminations: number;
  deaths: number;
  damageDealt: number;
  objectiveScore: number;
  objectiveCaptures: number;
  xpEarned: number;
  achievementsCompleted: string[];
  challengesCompleted: string[];
}

export interface EquippedProgressionCosmetics {
  titleId: string;
  badgeId: string;
}

export interface PlayerProfile {
  campaign: CampaignProgress;
  profileSchemaVersion: number;
  profileId: string;
  createdAt: string;
  updatedAt: string;
  displayName: string;
  lifetimeXp: number;
  highestLevel: number;
  career: CareerStatistics;
  weaponMastery: Record<string, WeaponMasteryRecord>;
  achievements: Record<string, AchievementProgress>;
  challenges: ChallengeState;
  entitlements: string[];
  equippedCosmetics: EquippedProgressionCosmetics;
  matchHistory: MatchHistoryEntry[];
  transactions: ProgressTransaction[];
}

export interface WeaponMatchStats {
  weaponId: string;
  shots: number;
  hits: number;
  damage: number;
  eliminations: number;
  criticalHits: number;
}

export interface MatchProgressionStats {
  mission?: MissionResult;
  destroyedPropIds?: readonly string[];
  snapshot: MatchSnapshot;
  weapons: readonly WeaponMatchStats[];
  tactical?: TacticalMatchStats;
}

export interface TacticalMatchStats {
  equipmentUses: number;
  explosiveDamage: number;
  explosiveEliminations: number;
  resourcesCollected: number;
  propsDestroyed: number;
}
export function emptyTacticalStats(): TacticalMatchStats { return { equipmentUses: 0, explosiveDamage: 0, explosiveEliminations: 0, resourcesCollected: 0, propsDestroyed: 0 }; }

export interface RewardBreakdownItem {
  source: string;
  amount: number;
}

export interface ProgressionRewardSummary {
  persisted?: boolean;
  matchId: string;
  outcome: MatchOutcome;
  previousLevel: number;
  currentLevel: number;
  previousXp: number;
  currentXp: number;
  xpEarned: number;
  breakdown: readonly RewardBreakdownItem[];
  levelsGained: number[];
  achievementsCompleted: string[];
  challengesCompleted: string[];
  masteryGains: readonly { weaponId: string; xp: number; tier: string }[];
  rewardsUnlocked: string[];
  career: CareerStatistics;
}

export function emptyCareerStatistics(): CareerStatistics {
  return {
    ...emptyTacticalStats(),
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    matchesDrawn: 0,
    eliminations: 0,
    deaths: 0,
    assists: 0,
    damageDealt: 0,
    damageReceived: 0,
    shotsFired: 0,
    shotsHit: 0,
    criticalHits: 0,
    playTimeSeconds: 0,
    objectiveCaptures: 0,
    objectiveScore: 0,
    survivalRounds: 0,
    bestSurvivalRound: 0,
    mapsCompleted: [],
    modesPlayed: [],
    weaponsUsed: [],
  };
}

export function cloneProfile(profile: PlayerProfile): PlayerProfile {
  return JSON.parse(JSON.stringify(profile)) as PlayerProfile;
}
