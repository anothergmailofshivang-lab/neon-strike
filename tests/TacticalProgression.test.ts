import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { MatchSession } from '../src/match/MatchSession';
import { createDefaultMatchSettings } from '../src/match/GameModeDefinitions';
import { CombatEventBus } from '../src/combat/CombatEvents';
import { DamageSystem } from '../src/combat/DamageSystem';
import { MatchCombatTracker } from '../src/progression/MatchCombatTracker';
import { TargetDummy } from '../src/targets/TargetDummy';
import { ProgressionService } from '../src/progression/ProgressionService';
import { ProfileService, normalizeProfile } from '../src/progression/ProfileService';
import { createWeaponCatalog, getWeaponDefinition } from '../src/weapons/WeaponDefinitions';
import { DEFAULT_PLAYER_LOADOUT } from '../src/loadouts/LoadoutDefinitions';
import type { MatchProgressionStats } from '../src/progression/ProgressionTypes';
import type { GameModeId } from '../src/match/MatchTypes';
import { migrateSaveData } from '../src/persistence/SaveMigrations';

describe('actual damage → match → progression bridge', () => {
  for (const mode of ['free-for-all', 'team-deathmatch', 'domination', 'survival', 'practice'] as const) it(`${mode}: attributes equipment correctly, finalizes once and preserves mastery`, () => {
    const session = new MatchSession({ ...createDefaultMatchSettings(mode), countdownSeconds: 0, scoreLimit: 1, rounds: 1 }, `equipment-${mode}`);
    const bus = new CombatEventBus(), damage = new DamageSystem(bus), tracker = new MatchCombatTracker(session, new Set(['crate']));
    session.addParticipant({ id: 'player', kind: 'player', displayName: 'Player', teamId: 'player' });
    session.addParticipant({ id: 'enemy', kind: 'npc', displayName: 'Enemy', teamId: 'enemy' });
    if (mode !== 'survival') session.addParticipant({ id: 'ally', kind: 'npc', displayName: 'Ally', teamId: 'player' });
    const target = new TargetDummy({ id: 'enemy', position: [0, 0, 0], maxHealth: 25, respawnDelay: 10, accentColor: 0 });
    damage.register(target);
    bus.subscribe((event) => tracker.combat(event));
    const progression = new ProgressionService(new ProfileService(null, DEFAULT_PLAYER_LOADOUT), createWeaponCatalog());
    let frozen: MatchProgressionStats | null = null;
    session.subscribe((event) => { if (event.type === 'match-completed') { frozen = tracker.snapshot(); progression.finalizeMatch(frozen); } });
    session.start();
    const used = { type: 'equipment-used' as const, ownerId: 'player', equipmentId: 'frag-grenade', slot: 'tactical' as const };
    tracker.event(used); tracker.event(used);
    tracker.event({ ...used, ownerId: 'ally' });
    damage.applyDirectDamage(target, 30, 'player', 'frag-grenade', new THREE.Vector3(), 0);
    if (mode === 'domination') session.awardObjectiveTick(new Map([['player', 1]]));
    if (!session.isResolved) session.resolve('Test completion', 'player', mode === 'practice' ? 'practice-complete' : 'victory');
    expect(frozen).not.toBeNull();
    const final = frozen as unknown as MatchProgressionStats;
    expect(final.weapons).toHaveLength(0);
    expect(final.tactical?.equipmentUses).toBe(1);
    expect(final.tactical?.explosiveEliminations).toBe(1);
    expect(final.snapshot.participants[0].stats.shotsHit).toBe(0);
    const firstXp = progression.profile.lifetimeXp;
    progression.finalizeMatch(final);
    const restored = new ProgressionService(new ProfileService(progression.profile, DEFAULT_PLAYER_LOADOUT), createWeaponCatalog());
    restored.finalizeMatch(final);
    expect(restored.profile.lifetimeXp).toBe(firstXp);
    expect(restored.profile.weaponMastery).toEqual({});
    expect(restored.profile.career.explosiveEliminations).toBe(mode === 'practice' ? 0 : 1);
    expect(restored.profile.matchHistory.length).toBe(mode === 'practice' ? 0 : 1);
    target.dispose();
  });

  it('records the final weapon kill before synchronous match-completed subscribers run', () => {
    const session = new MatchSession({ ...createDefaultMatchSettings('free-for-all'), countdownSeconds: 0, scoreLimit: 1 });
    session.addParticipant({ id: 'player', kind: 'player', displayName: 'Player', teamId: 'player' });
    session.addParticipant({ id: 'enemy', kind: 'npc', displayName: 'Enemy', teamId: 'enemy' });
    const bus = new CombatEventBus(), damage = new DamageSystem(bus), tracker = new MatchCombatTracker(session);
    const target = new TargetDummy({ id: 'enemy', position: [0, 0, -1], maxHealth: 20, respawnDelay: 10, accentColor: 0 });
    damage.register(target); bus.subscribe((event) => tracker.combat(event));
    let eliminationsAtResolution = 0;
    session.subscribe((event) => { if (event.type === 'match-completed') eliminationsAtResolution = tracker.snapshot().weapons[0].eliminations; });
    session.start(); const weapon = getWeaponDefinition('pistol');
    bus.emit({ type: 'weapon-fired', sourceId: 'player', weapon, shotCount: 1 });
    damage.applyWeaponHit(target, weapon, 'body', 1, new THREE.Vector3(), new THREE.Vector3(0, 0, -1), 0);
    expect(eliminationsAtResolution).toBe(1);
    expect(tracker.snapshot().weapons[0]).toMatchObject({ weaponId: 'pistol', shots: 1, hits: 1, damage: 20, eliminations: 1 });
    target.dispose();
  });

  it('props cannot farm combat damage/hits; aborts and practice cannot pay tactical achievements', () => {
    const session = new MatchSession({ ...createDefaultMatchSettings('domination'), countdownSeconds: 0 });
    session.addParticipant({ id: 'player', kind: 'player', displayName: 'Player', teamId: 'player' });
    const bus = new CombatEventBus(), damage = new DamageSystem(bus), tracker = new MatchCombatTracker(session, new Set(['crate']));
    const prop = new TargetDummy({ id: 'crate', position: [0, 0, 0], maxHealth: 20, respawnDelay: 10, accentColor: 0 });
    damage.register(prop); bus.subscribe((event) => tracker.combat(event)); session.start();
    damage.applyWeaponHit(prop, getWeaponDefinition('pistol'), 'body', 1, new THREE.Vector3(), new THREE.Vector3(), 0);
    expect(tracker.snapshot().tactical?.propsDestroyed).toBe(1);
    expect(tracker.snapshot().weapons).toHaveLength(0);
    expect(session.getParticipant('player')?.stats.damageDealt).toBe(0);
    session.abort();
    const service = new ProgressionService(new ProfileService(null, DEFAULT_PLAYER_LOADOUT), createWeaponCatalog());
    const stats = tracker.snapshot(); stats.snapshot.outcome = 'victory';
    service.finalizeMatch(stats);
    expect(service.profile.lifetimeXp).toBe(0); prop.dispose();
  });

  it('tactical milestones and Blast Drill pay once through the existing catalogs', () => {
    const session = new MatchSession({ ...createDefaultMatchSettings('team-deathmatch' as GameModeId), countdownSeconds: 0 });
    session.addParticipant({ id: 'player', kind: 'player', displayName: 'Player', teamId: 'player' }); session.start(); session.resolve('Completed', 'player');
    const service = new ProgressionService(new ProfileService(null, DEFAULT_PLAYER_LOADOUT), createWeaponCatalog());
    const stats = { snapshot: session.snapshot(), weapons: [], tactical: { equipmentUses: 6, explosiveDamage: 500, explosiveEliminations: 5, resourcesCollected: 10, propsDestroyed: 5 } };
    const summary = service.finalizeMatch(stats);
    expect(summary.achievementsCompleted).toEqual(expect.arrayContaining(['blast-confirmed', 'field-supplies', 'breach-work']));
    expect(summary.challengesCompleted).toContain('permanent-blast-drill');
    expect(service.finalizeMatch(stats).xpEarned).toBe(0);
  });
});

describe('equipment save migrations', () => {
  it('preserves version-1 skins/operative/weapons while supplying safe equipment defaults', () => {
    const legacy = { schemaVersion: 1, characterId: 'circuit', appearance: { characterId: 'circuit' }, loadout: { ...DEFAULT_PLAYER_LOADOUT, primaryWeaponId: 'sniper-rifle', primarySkinId: 'arctic', tacticalEquipmentId: 'removed-gadget' } };
    const migrated = migrateSaveData(legacy)!;
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.characterId).toBe('circuit');
    expect(migrated.loadout.primaryWeaponId).toBe('sniper-rifle');
    expect(migrated.loadout.primarySkinId).toBe('arctic');
    expect(migrated.loadout.tacticalEquipmentId).toBe('frag-grenade');
    const profile = normalizeProfile({ lifetimeXp: 550, career: { eliminations: 7 } }, DEFAULT_PLAYER_LOADOUT);
    expect(profile.career.explosiveEliminations).toBe(0); expect(profile.career.eliminations).toBe(7); expect(profile.lifetimeXp).toBe(550);
  });
});
