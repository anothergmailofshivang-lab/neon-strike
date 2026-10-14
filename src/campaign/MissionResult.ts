import type { MissionDefinition, MissionRating, MissionResult } from './CampaignTypes';

export function evaluateMissionRating(definition: MissionDefinition, result: Omit<MissionResult, 'rating'>): MissionRating {
  if (result.outcome !== 'success' || definition.objectives.some((o) => !o.optional && !result.completedObjectives.includes(o.id))) return 'none';
  const allOptional = definition.objectives.filter((o) => o.optional).every((o) => result.optionalObjectives.includes(o.id));
  if (!allOptional) return 'bronze';
  if (result.statistics.retries > 0 || result.statistics.damageTaken > 100) return 'silver';
  if (result.statistics.damageTaken > 40 || (definition.timeGoal !== undefined && result.statistics.seconds > definition.timeGoal)) return 'gold';
  return 'elite';
}

export function isBetterResult(definition: MissionDefinition, candidate: MissionResult, previous: MissionResult | null): boolean {
  if (candidate.outcome !== 'success') return false;
  if (!previous || previous.outcome !== 'success') return true;
  const tiers: MissionRating[] = ['none', 'bronze', 'silver', 'gold', 'elite'];
  const differences = [tiers.indexOf(candidate.rating) - tiers.indexOf(previous.rating), candidate.optionalObjectives.length - previous.optionalObjectives.length,
    previous.statistics.retries - candidate.statistics.retries, previous.statistics.damageTaken - candidate.statistics.damageTaken,
    definition.timeGoal ? previous.statistics.seconds - candidate.statistics.seconds : 0];
  // Exact ties retain the earlier verified record, including its difficulty.
  return (differences.find((difference) => difference !== 0) ?? 0) > 0;
}
