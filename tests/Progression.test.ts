import { describe, expect, it } from 'vitest';
import { createDefaultMatchSettings } from '../src/match/GameModeDefinitions';
import { createWeaponCatalog } from '../src/weapons/WeaponDefinitions';
import { DEFAULT_PLAYER_LOADOUT } from '../src/loadouts/LoadoutDefinitions';
import { ProfileService, createDefaultProfile } from '../src/progression/ProfileService';
import { ProgressionService } from '../src/progression/ProgressionService';
import { ChallengeService, toUtcDay, toUtcWeek } from '../src/progression/ChallengeService';
import { getLevelForXp, getLevelProgress, levelsCrossed, xpForLevel } from '../src/progression/ExperienceCurve';
import type { MatchProgressionStats } from '../src/progression/ProgressionTypes';
import type { MatchSnapshot } from '../src/match/MatchTypes';

function makeStats(sessionId: string, outcome: 'victory' | 'defeat' = 'victory'): MatchProgressionStats {
  const settings = createDefaultMatchSettings('free-for-all', 'modern-city');
  const snapshot: MatchSnapshot = {
    sessionId,
    settings: { ...settings, countdownSeconds: 0 },
    phase: 'completed',
    elapsedSeconds: 90,
    remainingSeconds: 90,
    countdownRemaining: 0,
    round: 1,
    roundCount: 1,
    teamScores: { player: 4, 'ffa:enemy': 1 },
    participants: [
      {
        id: 'player', displayName: 'PLAYER', teamId: 'player', kind: 'player', alive: true, lifeToken: 0,
        stats: { eliminations: 4, deaths: 1, damageDealt: 400, damageReceived: 100, shotsFired: 20, shotsHit: 10, criticalHits: 2, objectiveScore: 0, objectiveCaptures: 0, totalScore: 4 },
      },
    ],
    objectives: [],
    outcome,
    winnerTeamId: outcome === 'victory' ? 'player' : 'ffa:enemy',
    resolutionReason: 'test result',
  };
  return {
    snapshot,
    weapons: [
      { weaponId: 'assault-rifle', shots: 20, hits: 10, damage: 400, eliminations: 4, criticalHits: 2 },
      { weaponId: 'pistol', shots: 3, hits: 0, damage: 0, eliminations: 0, criticalHits: 0 },
    ],
  };
}

describe('experience curve', () => {
  it('handles exact thresholds, multi-level transitions, and the cap', () => {
    expect(getLevelForXp(0)).toBe(1);
    expect(getLevelForXp(xpForLevel(2) - 1)).toBe(1);
    expect(getLevelForXp(xpForLevel(2))).toBe(2);
    expect(levelsCrossed(0, xpForLevel(4))).toEqual([2, 3, 4]);
    expect(getLevelProgress(999999).capped).toBe(true);
    expect(getLevelProgress(999999).remaining).toBe(0);
  });
});

describe('local challenge rotation', () => {
  it('uses stable UTC day and week keys without rerolling on reload', () => {
    const challengeService = new ChallengeService(createWeaponCatalog());
    const first = createDefaultProfile(DEFAULT_PLAYER_LOADOUT);
    const second = createDefaultProfile(DEFAULT_PLAYER_LOADOUT);
    const date = new Date('2026-02-11T23:59:00Z');
    challengeService.ensureCurrent(first, date);
    challengeService.ensureCurrent(second, date);

    expect(toUtcDay(date)).toBe('2026-02-11');
    expect(toUtcWeek(date)).toBe('week-2026-02-09');
    expect(first.challenges.daily.map((entry) => entry.challengeId)).toEqual(second.challenges.daily.map((entry) => entry.challengeId));
    expect(first.challenges.weekly.map((entry) => entry.challengeId)).toEqual(second.challenges.weekly.map((entry) => entry.challengeId));
  });
});

describe('authoritative progression finalization', () => {
  it('awards career progress from a completed match exactly once', () => {
    const profile = createDefaultProfile(DEFAULT_PLAYER_LOADOUT, 'TEST');
    const service = new ProgressionService(new ProfileService(profile, DEFAULT_PLAYER_LOADOUT), createWeaponCatalog());
    const stats = makeStats('progression-once');

    const first = service.finalizeMatch(stats, new Date('2026-01-01T00:00:00Z'));
    const second = service.finalizeMatch(stats, new Date('2026-01-01T00:01:00Z'));
    const saved = service.profile;

    expect(first.xpEarned).toBeGreaterThan(0);
    expect(first.achievementsCompleted).toContain('getting-started');
    expect(saved.entitlements).toContain('weapon-skin:signal-flare');
    expect(saved.career.matchesPlayed).toBe(1);
    expect(saved.matchHistory).toHaveLength(1);
    expect(second.xpEarned).toBe(0);
    expect(second.rewardsUnlocked).toEqual([]);
  });

  it('attributes mastery to the weapon that generated the match events', () => {
    const service = new ProgressionService(new ProfileService(null, DEFAULT_PLAYER_LOADOUT), createWeaponCatalog());
    service.finalizeMatch(makeStats('mastery-attribution'));
    const profile = service.profile;

    expect(profile.weaponMastery['assault-rifle']?.eliminations).toBe(4);
    expect(profile.weaponMastery['assault-rifle']?.masteryXp).toBeGreaterThan(0);
    expect(profile.weaponMastery['pistol']?.eliminations).toBe(0);
    expect(profile.weaponMastery['pistol']?.masteryXp).toBe(0);
  });

  it('does not turn a practice result into career XP or a career match', () => {
    const service = new ProgressionService(new ProfileService(null, DEFAULT_PLAYER_LOADOUT), createWeaponCatalog());
    const stats = makeStats('practice-no-xp');
    stats.snapshot.settings.modeId = 'practice';
    stats.snapshot.outcome = 'practice-complete';
    const result = service.finalizeMatch(stats);

    expect(result.xpEarned).toBe(0);
    expect(service.profile.lifetimeXp).toBe(0);
    expect(service.profile.career.matchesPlayed).toBe(0);
    expect(service.profile.matchHistory).toHaveLength(0);
  });
});
