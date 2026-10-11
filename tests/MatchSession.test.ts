import { describe, expect, it } from 'vitest';
import { createDefaultMatchSettings, getGameModeDefinition, validateMatchSettings } from '../src/match/GameModeDefinitions';
import { MatchSession } from '../src/match/MatchSession';

describe('match session', () => {
  it('exposes five differentiated modes with validated defaults', () => {
    expect(getGameModeDefinition('free-for-all').teamMode).toBe('free-for-all');
    expect(getGameModeDefinition('team-deathmatch').teamMode).toBe('teams');
    expect(getGameModeDefinition('domination').supportsObjectives).toBe(true);
    expect(getGameModeDefinition('survival').rounds).toBe(3);
    expect(getGameModeDefinition('practice').supportsCompetitiveScore).toBe(false);
    expect(createDefaultMatchSettings('practice').countdownSeconds).toBe(0);
    const settings = validateMatchSettings({ ...createDefaultMatchSettings('team-deathmatch', 'missing'), npcCount: 999, durationSeconds: -5 }, ['modern-city']);
    expect(settings.mapId).toBe('modern-city');
    expect(settings.npcCount).toBe(8);
    expect(settings.durationSeconds).toBe(30);
  });

  it('runs countdown once, pauses the active clock, and resolves score limits once', () => {
    const session = new MatchSession({ ...createDefaultMatchSettings('free-for-all'), countdownSeconds: 1, scoreLimit: 2 }, 'test-match');
    session.addParticipant({ id: 'player', displayName: 'PLAYER', teamId: 'player', kind: 'player' });
    session.addParticipant({ id: 'enemy-a', displayName: 'A', teamId: 'ffa:enemy-a', kind: 'npc' });
    session.addParticipant({ id: 'enemy-b', displayName: 'B', teamId: 'ffa:enemy-b', kind: 'npc' });
    const events: string[] = [];
    session.subscribe((event) => events.push(event.type));
    session.start();
    expect(session.phase).toBe('countdown');
    session.update(0.5);
    expect(session.phase).toBe('countdown');
    session.update(0.5);
    session.update(0.5);
    session.update(0.5);
    expect(session.phase).toBe('active');
    session.setPaused(true);
    session.update(10);
    expect(session.snapshot().elapsedSeconds).toBe(0);
    session.setPaused(false);
    session.recordElimination('player', 'enemy-a');
    session.respawnParticipant('enemy-a');
    session.recordElimination('player', 'enemy-a');
    expect(session.phase).toBe('completed');
    expect(session.snapshot().outcome).toBe('victory');
    expect(events.filter((event) => event === 'match-completed')).toHaveLength(1);
  });

  it('blocks friendly fire at the authoritative participant scoring layer', () => {
    const session = new MatchSession({ ...createDefaultMatchSettings('team-deathmatch'), countdownSeconds: 0 }, 'friendly-fire');
    session.addParticipant({ id: 'player', displayName: 'PLAYER', teamId: 'player', kind: 'player' });
    session.addParticipant({ id: 'ally', displayName: 'ALLY', teamId: 'player', kind: 'npc' });
    session.start();
    expect(session.phase).toBe('active');
    expect(session.recordElimination('player', 'ally')).toBe(false);
    expect(session.snapshot().teamScores.player).toBe(0);
  });

  it('ends survival only after the last configured round is cleared', () => {
    const session = new MatchSession({ ...createDefaultMatchSettings('survival'), countdownSeconds: 0, rounds: 2 }, 'survival');
    session.addParticipant({ id: 'player', displayName: 'PLAYER', teamId: 'player', kind: 'player' });
    session.addParticipant({ id: 'enemy', displayName: 'ENEMY', teamId: 'enemy', kind: 'npc' });
    session.start();
    session.recordElimination('player', 'enemy');
    expect(session.phase).toBe('intermission');
    expect(session.startNextRound()).toBe(false);
    for (let index = 0; index < 10; index += 1) session.update(0.25);
    expect(session.startNextRound()).toBe(true);
    expect(session.phase).toBe('active');
    session.recordElimination('player', 'enemy');
    expect(session.snapshot().outcome).toBe('victory');
  });

  it('applies domination ticks centrally and resolves simultaneous score limits deterministically', () => {
    const session = new MatchSession({ ...createDefaultMatchSettings('domination'), countdownSeconds: 0, scoreLimit: 10 }, 'domination');
    session.addParticipant({ id: 'player', displayName: 'PLAYER', teamId: 'player', kind: 'player' });
    session.addParticipant({ id: 'enemy', displayName: 'ENEMY', teamId: 'enemy', kind: 'npc' });
    session.start();
    session.awardObjectiveTick(new Map([['player', 5], ['enemy', 5]]));
    expect(session.snapshot().teamScores).toMatchObject({ player: 5, enemy: 5 });
    session.awardObjectiveTick(new Map([['player', 5], ['enemy', 5]]));
    expect(session.snapshot().outcome).toBe('draw');
  });
});
