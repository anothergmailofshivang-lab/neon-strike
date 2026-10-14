import { getChallengeDefinition, listChallengeDefinitions, type ChallengeDefinition } from './ChallengeCatalog';
import type { MatchProgressionStats, PlayerProfile, ChallengeProgress } from './ProgressionTypes';
import type { WeaponDefinition } from '../weapons/WeaponTypes';

export interface ChallengeCompletion {
  definition: ChallengeDefinition;
  periodKey: string;
  rewardGranted: boolean;
}

export class ChallengeService {
  public constructor(private readonly weapons: ReadonlyMap<string, WeaponDefinition>) {}

  public ensureCurrent(profile: PlayerProfile, now = new Date()): void {
    const dailyPeriod = toUtcDay(now);
    const weeklyPeriod = toUtcWeek(now);
    if (profile.challenges.dailyPeriod !== dailyPeriod) {
      profile.challenges.dailyPeriod = dailyPeriod;
      profile.challenges.daily = selectChallenges('daily', dailyPeriod).map((definition) => createProgress(definition.id, dailyPeriod));
    }
    if (profile.challenges.weeklyPeriod !== weeklyPeriod) {
      profile.challenges.weeklyPeriod = weeklyPeriod;
      profile.challenges.weekly = selectChallenges('weekly', weeklyPeriod).map((definition) => createProgress(definition.id, weeklyPeriod));
    }
    for (const definition of listChallengeDefinitions().filter((entry) => entry.period === 'permanent')) if (!profile.challenges.permanent.some((entry) => entry.challengeId === definition.id)) profile.challenges.permanent.push(createProgress(definition.id, 'permanent'));
  }

  public applyMatch(profile: PlayerProfile, stats: MatchProgressionStats, now = new Date()): ChallengeCompletion[] {
    this.ensureCurrent(profile, now);
    const completions: ChallengeCompletion[] = [];
    for (const progress of [...profile.challenges.daily, ...profile.challenges.weekly, ...profile.challenges.permanent]) {
      const definition = getChallengeDefinition(progress.challengeId);
      if (!definition || progress.completed) continue;
      const increment = this.getIncrement(definition, stats);
      if (increment <= 0) continue;
      progress.progress = Math.min(definition.target, progress.progress + increment);
      if (progress.progress >= definition.target) {
        progress.completed = true;
        progress.completedAt = now.toISOString();
        const rewardGranted = !progress.rewardGranted;
        progress.rewardGranted = true;
        completions.push({ definition, periodKey: progress.periodKey, rewardGranted });
      }
    }
    return completions;
  }

  public list(profile: PlayerProfile, now = new Date()): readonly { definition: ChallengeDefinition; progress: ChallengeProgress }[] {
    this.ensureCurrent(profile, now);
    return [...profile.challenges.daily, ...profile.challenges.weekly, ...profile.challenges.permanent].flatMap((progress) => {
      const definition = getChallengeDefinition(progress.challengeId);
      return definition ? [{ definition, progress: { ...progress } }] : [];
    });
  }

  private getIncrement(definition: ChallengeDefinition, stats: MatchProgressionStats): number {
    const snapshot = stats.snapshot;
    const player = snapshot.participants.find((participant) => participant.id === 'player');
    if (!player || snapshot.settings.modeId === 'practice') return 0;
    if (definition.metric === 'explosive-eliminations') return stats.tactical?.explosiveEliminations ?? 0;
    if (definition.modeIds && (stats.mission || !definition.modeIds.includes(snapshot.settings.modeId))) return 0;
    if (definition.metric === 'match') return 1;
    if (definition.metric === 'win') return snapshot.outcome === 'victory' ? 1 : 0;
    if (definition.metric === 'eliminations') return player.stats.eliminations;
    if (definition.metric === 'damage') return player.stats.damageDealt;
    if (definition.metric === 'objective-captures') return player.stats.objectiveCaptures;
    if (definition.metric === 'survival-rounds') return !stats.mission && snapshot.settings.modeId === 'survival' && snapshot.outcome === 'victory' ? snapshot.round : 0;
    return stats.weapons.filter((weapon) => {
      const definitionForWeapon = this.weapons.get(weapon.weaponId);
      return weapon.eliminations > 0 && (!definition.weaponId || definition.weaponId === weapon.weaponId) && (!definition.weaponCategory || definition.weaponCategory === definitionForWeapon?.category);
    }).reduce((total, weapon) => total + weapon.eliminations, 0);
  }
}

export function toUtcDay(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function toUtcWeek(date: Date): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() - day + 1);
  return `week-${copy.getUTCFullYear()}-${String(copy.getUTCMonth() + 1).padStart(2, '0')}-${String(copy.getUTCDate()).padStart(2, '0')}`;
}

function createProgress(challengeId: string, periodKey: string): ChallengeProgress {
  return { challengeId, periodKey, progress: 0, completed: false, rewardGranted: false, completedAt: null };
}

function selectChallenges(period: 'daily' | 'weekly', periodKey: string): readonly ChallengeDefinition[] {
  const pool = listChallengeDefinitions().filter((definition) => definition.period === period);
  const selected: ChallengeDefinition[] = [];
  let state = hashString(`${period}:${periodKey}`);
  const desired = period === 'daily' ? 3 : 3;
  while (selected.length < Math.min(desired, pool.length)) {
    state = nextRandom(state);
    const candidate = pool[state % pool.length];
    if (!selected.some((entry) => entry.id === candidate.id)) selected.push(candidate);
  }
  return selected;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

function nextRandom(value: number): number {
  return (Math.imul(value, 1664525) + 1013904223) >>> 0;
}
