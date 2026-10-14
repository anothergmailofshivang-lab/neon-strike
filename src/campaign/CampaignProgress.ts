import { CAMPAIGN, MISSIONS, getMission } from './CampaignCatalog';
import type { CampaignProgress, MissionDefinition, MissionRecord, MissionResult } from './CampaignTypes';
import { evaluateMissionRating, isBetterResult } from './MissionResult';

export function emptyCampaignProgress(): CampaignProgress { return { schemaVersion: 1, selectedMissionId: MISSIONS[0].id, difficulty: 'normal', records: {}, milestones: [], recentResults: [], processedRuns: [] }; }
export function isMissionUnlocked(progress: CampaignProgress, mission: MissionDefinition): boolean { return Boolean(progress.records[mission.id]?.completedAt) || mission.requires.every((id) => Boolean(progress.records[id]?.completedAt)); }
export function recommendedMission(progress: CampaignProgress): MissionDefinition { return MISSIONS.find((m) => isMissionUnlocked(progress, m) && !progress.records[m.id]?.completedAt) ?? MISSIONS[MISSIONS.length - 1]; }
export function unlockedMissionIds(progress: CampaignProgress): string[] { return MISSIONS.filter((m) => isMissionUnlocked(progress, m)).map((m) => m.id); }

export function validateMissionResult(raw: unknown): MissionResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as MissionResult, definition = MISSIONS.find((m) => m.id === value.missionId);
  if (!definition || value.campaignId !== definition.campaignId || typeof value.sessionId !== 'string' || !value.sessionId || value.sessionId.length > 200 || !['success', 'failure', 'aborted'].includes(value.outcome) || !['easy', 'normal', 'hard', 'expert'].includes(value.difficulty)) return null;
  if (!value.statistics || Object.values(value.statistics).some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 10000000) || ['seconds', 'damageTaken', 'eliminations', 'retries'].some((key) => typeof value.statistics[key as keyof typeof value.statistics] !== 'number')) return null;
  const completed = strings(value.completedObjectives).filter((id) => definition.objectives.some((o) => o.id === id));
  if (completed.some((id) => definition.objectives.find((o) => o.id === id)!.requires.some((key) => !completed.includes(key)))) return null;
  if (value.outcome === 'success' && definition.objectives.some((o) => !o.optional && !completed.includes(o.id))) return null;
  const result: MissionResult = { sessionId: value.sessionId, missionId: definition.id, campaignId: definition.campaignId, difficulty: value.difficulty, outcome: value.outcome, reason: typeof value.reason === 'string' ? value.reason.slice(0, 240) : '', completedObjectives: completed,
    optionalObjectives: definition.objectives.filter((o) => o.optional && completed.includes(o.id)).map((o) => o.id), statistics: { ...value.statistics }, rating: 'none' };
  result.rating = evaluateMissionRating(definition, result); return result;
}

export function normalizeCampaignProgress(raw: unknown): CampaignProgress {
  const result = emptyCampaignProgress();
  if (!raw || typeof raw !== 'object') return result;
  const value = raw as Partial<CampaignProgress>;
  if (value.schemaVersion !== undefined && value.schemaVersion !== 1) return result;
  if (value.records && typeof value.records === 'object') for (const mission of MISSIONS) {
    const record = value.records[mission.id]; if (!record || typeof record !== 'object') continue;
    const best = validateMissionResult(record.best);
    const completedAt = validDate(record.completedAt) ? record.completedAt : null;
    result.records[mission.id] = { missionId: mission.id, completedAt, best: best?.missionId === mission.id && best.outcome === 'success' ? best : null,
      optionalObjectives: strings(record.optionalObjectives).filter((id) => mission.objectives.some((o) => o.id === id && o.optional)), successes: number(record.successes), failures: number(record.failures), aborts: number(record.aborts) };
  }
  result.processedRuns = strings(value.processedRuns).filter((id) => id.length <= 200).slice(-100);
  if (Array.isArray(value.recentResults)) for (const rawResult of value.recentResults.slice(-20)) {
    const record = validateMissionResult(rawResult);
    if (record && validDate(rawResult.timestamp) && !result.recentResults.some((r) => r.sessionId === record.sessionId)) result.recentResults.push({ ...record, timestamp: rawResult.timestamp });
  }
  if (MISSIONS.every((m) => result.records[m.id]?.completedAt)) result.milestones = [`${CAMPAIGN.id}:complete`];
  if (value.difficulty && ['easy', 'normal', 'hard', 'expert'].includes(value.difficulty)) result.difficulty = value.difficulty;
  result.selectedMissionId = MISSIONS.some((m) => m.id === value.selectedMissionId && isMissionUnlocked(result, m)) ? value.selectedMissionId! : recommendedMission(result).id;
  return result;
}

/** Mutates only a draft inside ProfileService's atomic reward transaction. */
export function recordMissionResult(progress: CampaignProgress, result: MissionResult, timestamp: string): { first: boolean; newOptional: number; improved: boolean } | null {
  if (progress.processedRuns.includes(result.sessionId)) return null;
  const definition = getMission(result.missionId);
  if (!isMissionUnlocked(progress, definition)) return null;
  const previous: MissionRecord = progress.records[definition.id] ?? { missionId: definition.id, completedAt: null, best: null, optionalObjectives: [], successes: 0, failures: 0, aborts: 0 };
  const first = result.outcome === 'success' && !previous.completedAt;
  const newOptional = result.outcome === 'success' ? result.optionalObjectives.filter((id) => !previous.optionalObjectives.includes(id)).length : 0;
  const improved = isBetterResult(definition, result, previous.best);
  if (result.outcome === 'success') {
    previous.successes++; previous.completedAt ??= timestamp;
    previous.optionalObjectives = [...new Set([...previous.optionalObjectives, ...result.optionalObjectives])];
    if (improved) previous.best = structuredClone(result);
  } else if (result.outcome === 'failure') previous.failures++;
  else previous.aborts++;
  progress.records[definition.id] = previous;
  progress.processedRuns = [...progress.processedRuns, result.sessionId].slice(-100);
  progress.recentResults = [...progress.recentResults, { ...structuredClone(result), timestamp }].slice(-20);
  if (MISSIONS.every((m) => progress.records[m.id]?.completedAt)) progress.milestones = [`${CAMPAIGN.id}:complete`];
  progress.selectedMissionId = recommendedMission(progress).id;
  return { first, newOptional, improved };
}

function strings(value: unknown): string[] { return [...new Set(Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])]; }
function validDate(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function number(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? Math.min(Math.max(Math.floor(value), 0), 1000000) : 0; }
