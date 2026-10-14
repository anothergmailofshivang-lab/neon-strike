import { getLevelForXp, getLevelProgress, levelsCrossed } from './ExperienceCurve';
import { AchievementService } from './AchievementService';
import { ChallengeService } from './ChallengeService';
import { InventoryService } from './InventoryService';
import { WeaponMasteryService } from './WeaponMasteryService';
import { getRewardDefinition } from './RewardCatalog';
import { getAchievementDefinition } from './AchievementCatalog';
import type {
  MatchProgressionStats,
  PlayerProfile,
  ProgressionRewardSummary,
  RewardBreakdownItem,
  CareerStatistics,
} from './ProgressionTypes';
import type { ProfileService } from './ProfileService';
import type { WeaponDefinition } from '../weapons/WeaponTypes';
import type { MissionResult } from '../campaign/CampaignTypes';
import { getMission } from '../campaign/CampaignCatalog';
import { isMissionUnlocked, recordMissionResult, validateMissionResult } from '../campaign/CampaignProgress';

export const LEVEL_REWARDS: Readonly<Record<number, string>> = {
  3: 'weapon-skin:signal-flare',
  8: 'weapon-skin:ion-bloom',
};

/** The only service allowed to turn finalized gameplay into career rewards. */
export class ProgressionService {
  private readonly achievements: AchievementService;
  private readonly challenges: ChallengeService;
  private readonly mastery: WeaponMasteryService;
  private readonly inventory: InventoryService;

  public constructor(
    private readonly profiles: ProfileService,
    weapons: ReadonlyMap<string, WeaponDefinition>,
  ) {
    this.inventory = new InventoryService();
    this.achievements = new AchievementService(this.inventory);
    this.challenges = new ChallengeService(weapons);
    this.mastery = new WeaponMasteryService(weapons, this.inventory);
  }

  public initialize(now = new Date()): void {
    this.profiles.update((profile) => {
      this.challenges.ensureCurrent(profile, now);
      const level = getLevelForXp(profile.lifetimeXp);
      for (const [requiredLevel, rewardId] of Object.entries(LEVEL_REWARDS)) {
        if (level >= Number(requiredLevel)) this.inventory.grant(profile, rewardId);
      }
    });
  }

  public get profile(): PlayerProfile {
    return this.profiles.profile;
  }

  public getLevelProgress(): ReturnType<typeof getLevelProgress> {
    return getLevelProgress(this.profile.lifetimeXp);
  }

  public getChallenges(now = new Date()): ReturnType<ChallengeService['list']> {
    const profile = this.profiles.profile;
    return this.challenges.list(profile, now);
  }

  public equipReward(rewardId: string): boolean {
    return this.profiles.transact((profile) => {
      const reward = getRewardDefinition(rewardId);
      if (!reward || !this.inventory.isOwned(profile, rewardId)) return false;
      if (reward.category === 'title') return this.inventory.equipTitle(profile, rewardId);
      if (reward.category === 'badge') return this.inventory.equipBadge(profile, rewardId);
      return false;
    }).result;
  }

  public canEquipWeaponSkin(rewardId: string, weapon: WeaponDefinition): boolean {
    return this.inventory.canEquipWeaponSkin(this.profile, rewardId, weapon);
  }

  public finalizeMatch(stats: MatchProgressionStats, now = new Date()): ProgressionRewardSummary {
    return this.finalize(stats, now);
  }

  public finalizeMission(raw: MissionResult, stats: MatchProgressionStats | null, now = new Date()): ProgressionRewardSummary | null {
    const result = validateMissionResult(raw);
    if (!result || !isMissionUnlocked(this.profile.campaign, getMission(result.missionId)) || this.profile.campaign.processedRuns.includes(result.sessionId)) return null;
    if (result.outcome !== 'success') {
      this.profiles.transact((profile) => recordMissionResult(profile.campaign, result, now.toISOString()));
      return null;
    }
    if (!stats || stats.snapshot.sessionId !== result.sessionId || stats.snapshot.phase !== 'completed' || stats.snapshot.outcome !== 'victory' || stats.snapshot.settings.mapId !== getMission(result.missionId).mapId || stats.snapshot.settings.difficulty !== result.difficulty) return null;
    return this.finalize({ ...stats, mission: result }, now);
  }

  private finalize(stats: MatchProgressionStats, now: Date): ProgressionRewardSummary {
    const existing = this.findFinalizedMatch(stats.snapshot.sessionId);
    if (existing) return this.duplicateSummary(stats, existing);

    let summary!: ProgressionRewardSummary;
    const transaction = this.profiles.transact((profile) => {
      const player = stats.snapshot.participants.find((participant) => participant.id === 'player');
      if (!player || stats.snapshot.outcome === null || stats.snapshot.phase !== 'completed') {
        summary = this.emptySummary(stats);
        return;
      }

      const previousXp = profile.lifetimeXp;
      const previousLevel = getLevelForXp(previousXp);
      const breakdown: RewardBreakdownItem[] = [];
      const unlocked: string[] = [];
      const challengeIds: string[] = [];
      const achievementIds: string[] = [];

      if (stats.snapshot.settings.modeId === 'practice') {
        summary = this.emptySummary(stats);
        return;
      }

      if (stats.mission) {
        const recorded = recordMissionResult(profile.campaign, stats.mission, now.toISOString());
        if (!recorded) { summary = this.emptySummary(stats); return; }
        if (recorded.first) addBreakdown(breakdown, 'First mission completion', getMission(stats.mission.missionId).firstCompletionXp);
        addBreakdown(breakdown, 'New optional records', recorded.newOptional * 25);
      }

      const completionXp = 100;
      const resultXp = stats.snapshot.outcome === 'victory' ? 100 : stats.snapshot.outcome === 'draw' ? 50 : 0;
      const eliminationXp = Math.min(player.stats.eliminations, 10) * 15;
      const objectiveXp = player.stats.objectiveCaptures * 35 + Math.min(player.stats.objectiveScore, 100);
      const survivalXp = !stats.mission && stats.snapshot.settings.modeId === 'survival' && stats.snapshot.outcome === 'victory'
        ? stats.snapshot.round * 40
        : 0;
      addBreakdown(breakdown, 'Match completion', completionXp);
      addBreakdown(breakdown, 'Match result', resultXp);
      addBreakdown(breakdown, 'Verified eliminations', eliminationXp);
      addBreakdown(breakdown, 'Objective contribution', objectiveXp);
      addBreakdown(breakdown, 'Survival rounds', survivalXp);

      this.updateCareer(profile.career, stats);
      const masteryResults = this.mastery.applyMatch(profile, stats);
      for (const result of masteryResults) if (result.rewardId) unlocked.push(result.rewardId);

      const matchXp = breakdown.reduce((total, item) => total + item.amount, 0);
      applyXp(profile, `match:${stats.snapshot.sessionId}`, matchXp, now, stats.snapshot.sessionId);
      profile.highestLevel = Math.max(profile.highestLevel, getLevelForXp(profile.lifetimeXp));

      const challengeCompletions = this.challenges.applyMatch(profile, stats, now);
      for (const completion of challengeCompletions) {
        challengeIds.push(completion.definition.id);
        if (completion.rewardGranted) applyXp(profile, `challenge:${completion.definition.period}:${completion.periodKey}:${completion.definition.id}`, completion.definition.xpReward, now, stats.snapshot.sessionId);
      }

      // Achievement evaluation is repeated after its own XP is applied so a
      // level milestone crossed by another achievement can also complete.
      for (let pass = 0; pass < 3; pass += 1) {
        const newlyCompleted = this.achievements.evaluate(profile, now);
        if (newlyCompleted.length === 0) break;
        for (const unlock of newlyCompleted) {
          achievementIds.push(unlock.definition.id);
          if (unlock.rewardId) unlocked.push(unlock.rewardId);
          applyXp(profile, `achievement:${unlock.definition.id}`, unlock.definition.xpReward, now, stats.snapshot.sessionId);
          profile.highestLevel = Math.max(profile.highestLevel, getLevelForXp(profile.lifetimeXp));
        }
      }

      const levelAfterRewards = getLevelForXp(profile.lifetimeXp);
      for (const level of levelsCrossed(previousXp, profile.lifetimeXp)) {
        const rewardId = LEVEL_REWARDS[level];
        if (rewardId && this.inventory.grant(profile, rewardId)) unlocked.push(rewardId);
      }
      profile.highestLevel = Math.max(profile.highestLevel, levelAfterRewards);

      const history = {
        ...(stats.mission ? { missionId: stats.mission.missionId } : {}),
        matchId: stats.snapshot.sessionId,
        timestamp: now.toISOString(),
        modeId: stats.snapshot.settings.modeId,
        mapId: stats.snapshot.settings.mapId,
        outcome: stats.snapshot.outcome,
        durationSeconds: Math.max(stats.snapshot.elapsedSeconds, 0),
        score: { ...stats.snapshot.teamScores },
        eliminations: player.stats.eliminations,
        deaths: player.stats.deaths,
        damageDealt: player.stats.damageDealt,
        objectiveScore: player.stats.objectiveScore,
        objectiveCaptures: player.stats.objectiveCaptures,
        xpEarned: profile.lifetimeXp - previousXp,
        achievementsCompleted: [...achievementIds],
        challengesCompleted: [...challengeIds],
      };
      profile.matchHistory.push(history);
      profile.matchHistory = profile.matchHistory.slice(-20);

      const currentXp = profile.lifetimeXp;
      summary = {
        matchId: stats.snapshot.sessionId,
        outcome: stats.snapshot.outcome,
        previousLevel,
        currentLevel: getLevelForXp(currentXp),
        previousXp,
        currentXp,
        xpEarned: currentXp - previousXp,
        breakdown: [
          ...breakdown,
          ...challengeCompletions.filter((completion) => completion.rewardGranted).map((completion) => ({ source: completion.definition.name, amount: completion.definition.xpReward })),
          ...achievementIds.map((id) => ({ source: this.achievementName(id), amount: this.achievementXp(id) })),
        ],
        levelsGained: levelsCrossed(previousXp, currentXp),
        achievementsCompleted: achievementIds,
        challengesCompleted: challengeIds,
        masteryGains: masteryResults.map((result) => ({ weaponId: result.weaponId, xp: result.xp, tier: result.tier })),
        rewardsUnlocked: [...new Set(unlocked)],
        career: cloneCareer(profile.career),
      };
    });
    summary.persisted = transaction.persisted;
    return summary;
  }

  private updateCareer(career: CareerStatistics, stats: MatchProgressionStats): void {
    const snapshot = stats.snapshot;
    const player = snapshot.participants.find((participant) => participant.id === 'player');
    if (!player) return;
    career.matchesPlayed += 1;
    if (stats.tactical) {
      for (const key of ['equipmentUses', 'explosiveDamage', 'explosiveEliminations', 'resourcesCollected', 'propsDestroyed'] as const) career[key] += Math.max(0, stats.tactical[key]);
    }
    if (snapshot.outcome === 'victory') career.matchesWon += 1;
    else if (snapshot.outcome === 'defeat') career.matchesLost += 1;
    else if (snapshot.outcome === 'draw') career.matchesDrawn += 1;
    career.eliminations += player.stats.eliminations;
    career.deaths += player.stats.deaths;
    career.damageDealt += player.stats.damageDealt;
    career.damageReceived += player.stats.damageReceived;
    career.shotsFired += player.stats.shotsFired;
    career.shotsHit += player.stats.shotsHit;
    career.criticalHits += player.stats.criticalHits;
    career.playTimeSeconds += Math.max(snapshot.elapsedSeconds, 0);
    career.objectiveCaptures += player.stats.objectiveCaptures;
    career.objectiveScore += player.stats.objectiveScore;
    if (!stats.mission && snapshot.settings.modeId === 'survival') {
      const rounds = snapshot.outcome === 'victory' ? snapshot.round : Math.max(snapshot.round - 1, 0);
      career.survivalRounds += rounds;
      career.bestSurvivalRound = Math.max(career.bestSurvivalRound, rounds);
    }
    addUnique(career.mapsCompleted, snapshot.settings.mapId);
    addUnique(career.modesPlayed, stats.mission ? 'campaign' : snapshot.settings.modeId);
    for (const weapon of stats.weapons) if (weapon.shots > 0 || weapon.hits > 0 || weapon.eliminations > 0) addUnique(career.weaponsUsed, weapon.weaponId);
  }

  private findFinalizedMatch(matchId: string) {
    return this.profile.matchHistory.find((entry) => entry.matchId === matchId)
      ?? (this.profile.transactions.some((transaction) => transaction.id === `match:${matchId}`) ? { matchId } : null);
  }

  private duplicateSummary(stats: MatchProgressionStats, existing: { matchId: string }): ProgressionRewardSummary {
    const profile = this.profile;
    return {
      matchId: existing.matchId,
      outcome: stats.snapshot.outcome ?? 'draw',
      previousLevel: getLevelForXp(profile.lifetimeXp),
      currentLevel: getLevelForXp(profile.lifetimeXp),
      previousXp: profile.lifetimeXp,
      currentXp: profile.lifetimeXp,
      xpEarned: 0,
      breakdown: [],
      levelsGained: [],
      achievementsCompleted: [],
      challengesCompleted: [],
      masteryGains: [],
      rewardsUnlocked: [],
      career: cloneCareer(profile.career),
    };
  }

  private emptySummary(stats: MatchProgressionStats): ProgressionRewardSummary {
    const profile = this.profile;
    const level = getLevelForXp(profile.lifetimeXp);
    return {
      matchId: stats.snapshot.sessionId,
      outcome: stats.snapshot.outcome ?? 'practice-complete',
      previousLevel: level,
      currentLevel: level,
      previousXp: profile.lifetimeXp,
      currentXp: profile.lifetimeXp,
      xpEarned: 0,
      breakdown: [],
      levelsGained: [],
      achievementsCompleted: [],
      challengesCompleted: [],
      masteryGains: [],
      rewardsUnlocked: [],
      career: cloneCareer(profile.career),
    };
  }

  private achievementName(id: string): string {
    return getAchievementDefinition(id)?.name ?? id.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private achievementXp(id: string): number {
    return getAchievementDefinition(id)?.xpReward ?? 0;
  }
}

function applyXp(profile: PlayerProfile, transactionId: string, xp: number, now = new Date(), matchId?: string): void {
  if (!Number.isFinite(xp) || xp <= 0 || profile.transactions.some((entry) => entry.id === transactionId)) return;
  profile.lifetimeXp += Math.floor(xp);
  profile.transactions.push({ id: transactionId, source: transactionId.split(':')[0], xp: Math.floor(xp), timestamp: now.toISOString(), matchId });
  profile.transactions = profile.transactions.slice(-100);
}

function addBreakdown(items: RewardBreakdownItem[], source: string, amount: number): void {
  if (amount > 0) items.push({ source, amount });
}

function addUnique(items: string[], value: string): void {
  if (!items.includes(value)) items.push(value);
}

function cloneCareer(career: CareerStatistics): CareerStatistics {
  return { ...career, mapsCompleted: [...career.mapsCompleted], modesPlayed: [...career.modesPlayed], weaponsUsed: [...career.weaponsUsed] };
}
