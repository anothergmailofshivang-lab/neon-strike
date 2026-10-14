import { describe, it, expect } from 'vitest';
import { MISSIONS, getMission } from '../src/campaign/CampaignCatalog';
import { emptyCampaignProgress, isMissionUnlocked, normalizeCampaignProgress, recommendedMission, validateMissionResult } from '../src/campaign/CampaignProgress';
import { evaluateMissionRating, isBetterResult } from '../src/campaign/MissionResult';
import type { MissionResult } from '../src/campaign/CampaignTypes';
import { ProfileService, createDefaultProfile } from '../src/progression/ProfileService';
import { ProgressionService } from '../src/progression/ProgressionService';
import { ProgressionSaveManager, PROGRESSION_STORAGE_KEY, PROGRESSION_BACKUP_KEY } from '../src/persistence/ProgressionSaveManager';
import { DEFAULT_PLAYER_LOADOUT } from '../src/loadouts/LoadoutDefinitions';
import { createWeaponCatalog } from '../src/weapons/WeaponDefinitions';
import { MatchSession } from '../src/match/MatchSession';
import { createDefaultMatchSettings } from '../src/match/GameModeDefinitions';
import { PROFILE_SCHEMA_VERSION } from '../src/progression/ProgressionTypes';

const now = new Date('2026-10-14T12:00:00Z');
let id = 0;
function result(missionId = 'dead-air', optional = true): MissionResult {
  const definition = getMission(missionId);
  const value: MissionResult = { sessionId: `test-run-${++id}`, campaignId: definition.campaignId, missionId, difficulty: 'normal', outcome: 'success', reason: 'Extracted', rating: 'none', completedObjectives: definition.objectives.filter((o) => optional || !o.optional).map((o) => o.id), optionalObjectives: optional ? definition.objectives.filter((o) => o.optional).map((o) => o.id) : [], statistics: { seconds: 120, damageTaken: 20, eliminations: 2, retries: 0 } };
  value.rating = evaluateMissionRating(definition, value); return value;
}
function stats(value: MissionResult) {
  const match = new MatchSession({ ...createDefaultMatchSettings('survival', getMission(value.missionId).mapId), countdownSeconds: 0, difficulty: value.difficulty }, value.sessionId, true);
  match.addParticipant({ id: 'player', teamId: 'player', displayName: 'PLAYER', kind: 'player' }); match.start(); match.resolve('Extracted', 'player', 'victory');
  return { snapshot: match.snapshot(), weapons: [] };
}
class Storage {
  data = new Map<string, string>(); fail = false;
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.fail) throw new Error('Storage full'); this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}
function fixture(storage = new Storage()) {
  const save = new ProgressionSaveManager(storage), profiles = new ProfileService(save.load(DEFAULT_PLAYER_LOADOUT), DEFAULT_PLAYER_LOADOUT, (profile) => save.save(profile));
  return { storage, save, profiles, service: new ProgressionService(profiles, createWeaponCatalog()) };
}

describe('campaign persistence and reward transactions', () => {
  it('starts with one available mission and rejects locked or incomplete result transactions', () => {
    const f = fixture(); expect(MISSIONS.filter((m) => isMissionUnlocked(f.service.profile.campaign, m))).toHaveLength(1);
    const locked = result('last-carrier'); expect(f.service.finalizeMission(locked, stats(locked), now)).toBeNull();
    const incomplete = result(); incomplete.completedObjectives = ['approach']; expect(f.service.finalizeMission(incomplete, stats(incomplete), now)).toBeNull();
    expect(f.service.profile.lifetimeXp).toBe(0); expect(recommendedMission(emptyCampaignProgress()).id).toBe('dead-air');
  });
  it('commits unlocks, first reward and optional reward atomically, and remains exact-once after reload', () => {
    const f = fixture(), run = result();
    const reward = f.service.finalizeMission(run, stats(run), now)!;
    expect(reward.breakdown).toEqual(expect.arrayContaining([{ source: 'First mission completion', amount: 200 }, { source: 'New optional records', amount: 25 }]));
    expect(isMissionUnlocked(f.service.profile.campaign, getMission('perimeter-receipt'))).toBe(true);
    expect(f.service.profile.career.survivalRounds).toBe(0); expect(f.service.profile.career.modesPlayed).toContain('campaign');
    const reloaded = fixture(f.storage); expect(reloaded.service.finalizeMission(run, stats(run), now)).toBeNull();
    expect(reloaded.service.profile.lifetimeXp).toBe(f.service.profile.lifetimeXp);
    expect(reloaded.service.profile.campaign.recentResults).toHaveLength(1);
    const replay = result(); const repeated = reloaded.service.finalizeMission(replay, stats(replay), now)!;
    expect(repeated.breakdown.some((r) => r.source === 'First mission completion' || r.source === 'New optional records')).toBe(false);
    expect(reloaded.service.profile.campaign.records['dead-air'].best?.sessionId).toBe(run.sessionId);
  });
  it('records failures/aborts without XP, and replay failures never erase canonical success', () => {
    const f = fixture(), failure = result(); failure.outcome = 'failure'; failure.completedObjectives = []; failure.optionalObjectives = [];
    f.service.finalizeMission(failure, null, now); f.service.finalizeMission(failure, null, now);
    expect(f.service.profile.campaign.records['dead-air'].failures).toBe(1); expect(f.service.profile.lifetimeXp).toBe(0); expect(isMissionUnlocked(f.service.profile.campaign, getMission('perimeter-receipt'))).toBe(false);
    const success = result(); f.service.finalizeMission(success, stats(success), now); const xp = f.service.profile.lifetimeXp;
    const abort = { ...failure, sessionId: 'abort-after-success', outcome: 'aborted' as const };
    f.service.finalizeMission(abort, null, now); expect(f.service.profile.lifetimeXp).toBe(xp); expect(f.service.profile.campaign.records['dead-air'].completedAt).toBeTruthy();
    expect(f.service.profile.campaign.records['dead-air'].best?.outcome).toBe('success');
  });
  it('grants newly recovered optional evidence once on an improved replay', () => {
    const f = fixture(), first = result('dead-air', false); f.service.finalizeMission(first, stats(first), now);
    const next = result(); expect(f.service.finalizeMission(next, stats(next), now)?.breakdown).toContainEqual({ source: 'New optional records', amount: 25 });
    expect(f.service.profile.campaign.records['dead-air'].best?.rating).toBe('elite');
  });
  it('initializes schema-3 profiles without losing career, equipment-related stats, cosmetics or mastery', () => {
    const storage = new Storage(), previous = createDefaultProfile(DEFAULT_PLAYER_LOADOUT);
    previous.profileSchemaVersion = 3; previous.lifetimeXp = 650; previous.career.propsDestroyed = 8; previous.entitlements.push('title:combat-veteran');
    previous.weaponMastery.pistol = { weaponId: 'pistol', masteryXp: 100, eliminations: 5, hits: 10, shots: 15, damage: 200, matchesUsed: 2, highestTier: 1 };
    storage.data.set(PROGRESSION_STORAGE_KEY, JSON.stringify({ profile: { ...previous, campaign: undefined } }));
    const f = fixture(storage); expect(f.service.profile.profileSchemaVersion).toBe(PROFILE_SCHEMA_VERSION); expect(f.service.profile.lifetimeXp).toBe(650); expect(f.service.profile.weaponMastery.pistol.masteryXp).toBe(100); expect(f.service.profile.career.propsDestroyed).toBe(8); expect(f.service.profile.entitlements).toContain('title:combat-veteran'); expect(f.service.profile.campaign.records).toEqual({});
  });
  it('normalizes bad records independently and safely ignores obsolete mission IDs and future schemas', () => {
    const f = fixture(), run = result(); f.service.finalizeMission(run, stats(run), now);
    const progress = structuredClone(f.service.profile.campaign) as unknown as Record<string, unknown>;
    const records = progress.records as Record<string, unknown>;
    records['removed-operation'] = { completedAt: now.toISOString(), best: run }; records['perimeter-receipt'] = { completedAt: 'not a date', best: { ...run, missionId: 'perimeter-receipt', statistics: { damageTaken: -1 } } };
    progress.selectedMissionId = 'removed-operation'; progress.processedRuns = [run.sessionId, run.sessionId];
    const normalized = normalizeCampaignProgress(progress); expect(normalized.records['dead-air'].completedAt).toBeTruthy(); expect(normalized.records['removed-operation']).toBeUndefined(); expect(normalized.records['perimeter-receipt'].completedAt).toBeNull(); expect(normalized.processedRuns).toEqual([run.sessionId]);
    expect(normalizeCampaignProgress({ schemaVersion: 99, records }).records).toEqual({});
  });
  it('recovers a corrupt primary from backup, and storage failure preserves current-session exact-once behavior', () => {
    const f = fixture(), run = result(); f.service.finalizeMission(run, stats(run), now);
    f.storage.data.set(PROGRESSION_BACKUP_KEY, f.storage.getItem(PROGRESSION_STORAGE_KEY)!); f.storage.data.set(PROGRESSION_STORAGE_KEY, '{broken');
    const restored = fixture(f.storage); expect(restored.service.profile.campaign.records['dead-air'].completedAt).toBeTruthy();
    restored.storage.fail = true; const next = result('perimeter-receipt'); restored.service.finalizeMission(next, stats(next), now); const xp = restored.service.profile.lifetimeXp;
    expect(restored.service.finalizeMission(next, stats(next), now)).toBeNull(); expect(restored.service.profile.lifetimeXp).toBe(xp); expect(isMissionUnlocked(restored.service.profile.campaign, getMission('cold-ledger'))).toBe(true);
  });
  it('rolls back a failed transaction rather than paying partially', () => {
    const profiles = new ProfileService(null, DEFAULT_PLAYER_LOADOUT, () => { throw new Error('Interrupted write'); });
    const service = new ProgressionService(profiles, createWeaponCatalog()), run = result();
    expect(() => service.finalizeMission(run, stats(run), now)).toThrow('Interrupted write'); expect(service.profile.lifetimeXp).toBe(0); expect(service.profile.campaign.records).toEqual({});
  });
});

describe('transparent mission ratings', () => {
  it('rates real completion, optional records, retry and damage criteria', () => {
    const def = getMission('dead-air'), run = result(); expect(run.rating).toBe('elite');
    expect(evaluateMissionRating(def, { ...run, outcome: 'failure' })).toBe('none');
    expect(evaluateMissionRating(def, result('dead-air', false))).toBe('bronze');
    run.statistics.damageTaken = 70; expect(evaluateMissionRating(def, run)).toBe('gold');
    run.statistics.retries = 1; expect(evaluateMissionRating(def, run)).toBe('silver');
  });
  it('uses time only on the mission with a declared time goal and retains exact ties', () => {
    const run = result(); run.statistics.seconds = 999; expect(evaluateMissionRating(getMission('dead-air'), run)).toBe('elite');
    const timed = result('breaker-window'); timed.statistics.seconds = 999; expect(evaluateMissionRating(getMission('breaker-window'), timed)).toBe('gold');
    const same = { ...run, sessionId: 'later' }; expect(isBetterResult(getMission('dead-air'), same, run)).toBe(false);
    const faster = structuredClone(same); faster.statistics.seconds = 20; expect(isBetterResult(getMission('dead-air'), faster, run)).toBe(false);
    expect(validateMissionResult({ ...run, rating: 'fabricated-rating' })?.rating).toBe('elite');
  });
});
