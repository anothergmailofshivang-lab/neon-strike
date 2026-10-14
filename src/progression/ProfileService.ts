import type { PlayerLoadout } from '../loadouts/LoadoutTypes';
import type { GameModeId, MatchOutcome } from '../match/MatchTypes';
import { MAX_MATCH_HISTORY, MAX_PROGRESS_TRANSACTIONS, PROFILE_SCHEMA_VERSION, cloneProfile, emptyCareerStatistics, type ChallengeState, type PlayerProfile } from './ProgressionTypes';
import { getRewardDefinition, rewardIdForWeaponSkin } from './RewardCatalog';
import { getLevelForXp } from './ExperienceCurve';
import { emptyCampaignProgress, normalizeCampaignProgress } from '../campaign/CampaignProgress';

export type ProfileSaveCallback = (profile: PlayerProfile) => boolean;

export function createChallengeState(): ChallengeState {
  return { dailyPeriod: '', daily: [], weeklyPeriod: '', weekly: [], permanent: [] };
}

export function createDefaultProfile(loadout: PlayerLoadout, displayName = 'PLAYER', now = new Date()): PlayerProfile {
  const timestamp = now.toISOString();
  const entitlements = new Set([
    'badge:rookie',
    ...['standard', 'neon-circuit', 'sandstorm', 'arctic', 'dark-carbon'].map(rewardIdForWeaponSkin),
  ]);
  entitlements.add(rewardIdForWeaponSkin(loadout.primarySkinId));
  entitlements.add(rewardIdForWeaponSkin(loadout.secondarySkinId));
  return {
    campaign: emptyCampaignProgress(),
    profileSchemaVersion: PROFILE_SCHEMA_VERSION,
    profileId: `local-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    displayName: sanitizeDisplayName(displayName),
    lifetimeXp: 0,
    highestLevel: 1,
    career: emptyCareerStatistics(),
    weaponMastery: {},
    achievements: {},
    challenges: createChallengeState(),
    entitlements: [...entitlements],
    equippedCosmetics: { titleId: '', badgeId: 'badge:rookie' },
    matchHistory: [],
    transactions: [],
  };
}

export function sanitizeDisplayName(value: unknown): string {
  if (typeof value !== 'string') return 'PLAYER';
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24);
  return normalized || 'PLAYER';
}

export function normalizeProfile(raw: unknown, fallbackLoadout: PlayerLoadout, now = new Date()): PlayerProfile {
  const fallback = createDefaultProfile(fallbackLoadout, 'PLAYER', now);
  if (!raw || typeof raw !== 'object') return fallback;
  const value = raw as Partial<PlayerProfile>;
  const career = value.career && typeof value.career === 'object' ? value.career as Partial<PlayerProfile['career']> : {};
  const lifetimeXp = finiteNonNegative(value.lifetimeXp);
  const normalized: PlayerProfile = {
    ...fallback,
    profileSchemaVersion: PROFILE_SCHEMA_VERSION,
    profileId: typeof value.profileId === 'string' && value.profileId.trim() ? value.profileId : fallback.profileId,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : fallback.createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : fallback.updatedAt,
    displayName: sanitizeDisplayName(value.displayName),
    lifetimeXp,
    highestLevel: Math.max(integerInRange(value.highestLevel, 1, 50, 1), getLevelForXp(lifetimeXp)),
    career: {
      equipmentUses: integerNonNegative(career.equipmentUses), explosiveDamage: finiteNonNegative(career.explosiveDamage), explosiveEliminations: integerNonNegative(career.explosiveEliminations), resourcesCollected: integerNonNegative(career.resourcesCollected), propsDestroyed: integerNonNegative(career.propsDestroyed),
      matchesPlayed: integerNonNegative(career.matchesPlayed), matchesWon: integerNonNegative(career.matchesWon), matchesLost: integerNonNegative(career.matchesLost), matchesDrawn: integerNonNegative(career.matchesDrawn),
      eliminations: integerNonNegative(career.eliminations), deaths: integerNonNegative(career.deaths), assists: integerNonNegative(career.assists),
      damageDealt: finiteNonNegative(career.damageDealt), damageReceived: finiteNonNegative(career.damageReceived), shotsFired: integerNonNegative(career.shotsFired), shotsHit: integerNonNegative(career.shotsHit), criticalHits: integerNonNegative(career.criticalHits),
      playTimeSeconds: finiteNonNegative(career.playTimeSeconds), objectiveCaptures: integerNonNegative(career.objectiveCaptures), objectiveScore: integerNonNegative(career.objectiveScore), survivalRounds: integerNonNegative(career.survivalRounds), bestSurvivalRound: integerNonNegative(career.bestSurvivalRound),
      mapsCompleted: stringArray(career.mapsCompleted), modesPlayed: stringArray(career.modesPlayed), weaponsUsed: stringArray(career.weaponsUsed),
    },
    weaponMastery: normalizeWeaponMastery(value.weaponMastery),
    achievements: normalizeAchievements(value.achievements),
    challenges: normalizeChallengeState(value.challenges),
    entitlements: uniqueStrings([...(Array.isArray(value.entitlements) ? value.entitlements : []), ...fallback.entitlements]),
    equippedCosmetics: normalizeEquipped(value.equippedCosmetics),
    matchHistory: normalizeHistory(value.matchHistory),
    transactions: normalizeTransactions(value.transactions),
    campaign: normalizeCampaignProgress(value.campaign),
  };
  const selectedSkinIds = [fallbackLoadout.primarySkinId, fallbackLoadout.secondarySkinId, 'standard'];
  for (const skinId of selectedSkinIds) {
    const entitlement = rewardIdForWeaponSkin(skinId);
    if (!normalized.entitlements.includes(entitlement)) normalized.entitlements.push(entitlement);
  }
  return normalized;
}

export class ProfileService {
  private value: PlayerProfile;

  public constructor(initial: unknown, fallbackLoadout: PlayerLoadout, private readonly saveCallback: ProfileSaveCallback = () => false) {
    this.value = normalizeProfile(initial, fallbackLoadout);
  }

  public get profile(): PlayerProfile {
    return cloneProfile(this.value);
  }

  public update(work: (profile: PlayerProfile) => void): boolean {
    return this.transact(work).persisted;
  }

  public transact<T>(work: (profile: PlayerProfile) => T): { result: T; persisted: boolean } {
    const before = this.value;
    const draft = cloneProfile(before);
    try {
      const result = work(draft);
      draft.updatedAt = new Date().toISOString();
      draft.lifetimeXp = finiteNonNegative(draft.lifetimeXp);
      draft.highestLevel = Math.max(integerInRange(draft.highestLevel, 1, 50, 1), getLevelForXp(draft.lifetimeXp));
      draft.entitlements = uniqueStrings(draft.entitlements);
      draft.matchHistory = draft.matchHistory.slice(-MAX_MATCH_HISTORY);
      draft.transactions = draft.transactions.slice(-MAX_PROGRESS_TRANSACTIONS);
      this.value = draft;
      return { result, persisted: this.saveCallback(cloneProfile(draft)) };
    } catch (error) {
      this.value = before;
      throw error;
    }
  }
}

function finiteNonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function integerNonNegative(value: unknown): number {
  return Math.floor(finiteNonNegative(value));
}

function integerInRange(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(Math.max(Math.floor(value), minimum), maximum) : fallback;
}

function stringArray(value: unknown): string[] {
  return uniqueStrings(Array.isArray(value) ? value : []);
}

function uniqueStrings(value: unknown): string[] {
  return [...new Set(Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : [])];
}

function normalizeWeaponMastery(value: unknown): PlayerProfile['weaponMastery'] {
  if (!value || typeof value !== 'object') return {};
  const records: PlayerProfile['weaponMastery'] = {};
  for (const [weaponId, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== 'object') continue;
    const record = raw as Partial<PlayerProfile['weaponMastery'][string]>;
    records[weaponId] = {
      weaponId,
      masteryXp: finiteNonNegative(record.masteryXp), eliminations: integerNonNegative(record.eliminations), hits: integerNonNegative(record.hits), shots: integerNonNegative(record.shots), damage: finiteNonNegative(record.damage), matchesUsed: integerNonNegative(record.matchesUsed), highestTier: integerInRange(record.highestTier, 0, 4, 0),
    };
  }
  return records;
}

function normalizeAchievements(value: unknown): PlayerProfile['achievements'] {
  if (!value || typeof value !== 'object') return {};
  const achievements: PlayerProfile['achievements'] = {};
  for (const [id, raw] of Object.entries(value)) {
    const entry = raw && typeof raw === 'object' ? raw as Partial<PlayerProfile['achievements'][string]> : {};
    achievements[id] = { progress: finiteNonNegative(entry.progress), completedAt: typeof entry.completedAt === 'string' ? entry.completedAt : null };
  }
  return achievements;
}

function normalizeChallengeState(value: unknown): ChallengeState {
  if (!value || typeof value !== 'object') return createChallengeState();
  const state = value as Partial<ChallengeState>;
  const normalize = (entries: unknown): ChallengeState['daily'] => Array.isArray(entries) ? entries.filter((entry): entry is ChallengeState['daily'][number] => Boolean(entry && typeof entry === 'object')).map((entry) => ({
    challengeId: typeof entry.challengeId === 'string' ? entry.challengeId : '', periodKey: typeof entry.periodKey === 'string' ? entry.periodKey : '', progress: finiteNonNegative(entry.progress), completed: entry.completed === true, rewardGranted: entry.rewardGranted === true, completedAt: typeof entry.completedAt === 'string' ? entry.completedAt : null,
  })).filter((entry) => entry.challengeId.length > 0) : [];
  return { dailyPeriod: typeof state.dailyPeriod === 'string' ? state.dailyPeriod : '', daily: normalize(state.daily), weeklyPeriod: typeof state.weeklyPeriod === 'string' ? state.weeklyPeriod : '', weekly: normalize(state.weekly), permanent: normalize(state.permanent) };
}

function normalizeEquipped(value: unknown): PlayerProfile['equippedCosmetics'] {
  const entry = value && typeof value === 'object' ? value as Partial<PlayerProfile['equippedCosmetics']> : {};
  const title = typeof entry.titleId === 'string' && getRewardDefinition(entry.titleId)?.category === 'title' ? entry.titleId : '';
  const badge = typeof entry.badgeId === 'string' && getRewardDefinition(entry.badgeId)?.category === 'badge' ? entry.badgeId : 'badge:rookie';
  return { titleId: title, badgeId: badge };
}

function normalizeHistory(value: unknown): PlayerProfile['matchHistory'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const entry = raw as Partial<PlayerProfile['matchHistory'][number]>;
    const modeId = isGameModeId(entry.modeId) ? entry.modeId : null;
    const outcome = isMatchOutcome(entry.outcome) ? entry.outcome : null;
    if (typeof entry.matchId !== 'string' || !entry.matchId || !modeId || !outcome || typeof entry.mapId !== 'string') return [];
    const score = entry.score && typeof entry.score === 'object'
      ? Object.fromEntries(Object.entries(entry.score).filter(([, amount]) => typeof amount === 'number' && Number.isFinite(amount)).map(([team, amount]) => [team, amount as number]))
      : {};
    return [{
      ...(typeof entry.missionId === 'string' ? { missionId: entry.missionId } : {}),
      matchId: entry.matchId,
      timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : '',
      modeId,
      mapId: entry.mapId,
      outcome,
      durationSeconds: finiteNonNegative(entry.durationSeconds),
      score,
      eliminations: integerNonNegative(entry.eliminations),
      deaths: integerNonNegative(entry.deaths),
      damageDealt: finiteNonNegative(entry.damageDealt),
      objectiveScore: integerNonNegative(entry.objectiveScore),
      objectiveCaptures: integerNonNegative(entry.objectiveCaptures),
      xpEarned: integerNonNegative(entry.xpEarned),
      achievementsCompleted: stringArray(entry.achievementsCompleted),
      challengesCompleted: stringArray(entry.challengesCompleted),
    }];
  }).slice(-MAX_MATCH_HISTORY);
}

function normalizeTransactions(value: unknown): PlayerProfile['transactions'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const entry = raw as Partial<PlayerProfile['transactions'][number]>;
    if (typeof entry.id !== 'string' || !entry.id || typeof entry.source !== 'string') return [];
    return [{ id: entry.id, source: entry.source, xp: integerNonNegative(entry.xp), timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : '', ...(typeof entry.matchId === 'string' ? { matchId: entry.matchId } : {}) }];
  }).slice(-MAX_PROGRESS_TRANSACTIONS);
}

function isGameModeId(value: unknown): value is GameModeId {
  return value === 'free-for-all' || value === 'team-deathmatch' || value === 'domination' || value === 'survival' || value === 'practice';
}

function isMatchOutcome(value: unknown): value is MatchOutcome {
  return value === 'victory' || value === 'defeat' || value === 'draw' || value === 'practice-complete';
}
