import type { DifficultyConfig } from '../ai/NPCDifficulty';
import type { GameModeId, MatchSettings, TeamId } from './MatchTypes';

export interface GameModeDefinition {
  id: GameModeId;
  displayName: string;
  description: string;
  objective: string;
  winCondition: string;
  tags: readonly string[];
  timed: boolean;
  scoreLimit: number;
  durationSeconds: number;
  npcCount: number;
  respawnsEnabled: boolean;
  rounds: number;
  teamMode: 'free-for-all' | 'teams' | 'objectives' | 'survival' | 'practice';
  supportsObjectives: boolean;
  supportsCompetitiveScore: boolean;
  defaultTeams: readonly TeamId[];
}

export const GAME_MODE_DEFINITIONS: readonly GameModeDefinition[] = [
  {
    id: 'free-for-all', displayName: 'FREE-FOR-ALL',
    description: 'Every operative is an independent rival. Hunt, survive, and lead the elimination board.',
    objective: 'Eliminate opponents before the clock expires.', winCondition: 'First to the target score, or highest score at time.',
    tags: ['Solo Rivalry', 'Respawns', 'Eliminations'], timed: true, scoreLimit: 10, durationSeconds: 180, npcCount: 4,
    respawnsEnabled: true, rounds: 1, teamMode: 'free-for-all', supportsObjectives: false, supportsCompetitiveScore: true, defaultTeams: ['player', 'enemy'],
  },
  {
    id: 'team-deathmatch', displayName: 'TEAM DEATHMATCH',
    description: 'Fight beside allied AI against an opposing squad in a race to the team score limit.',
    objective: 'Work with allied operatives to eliminate the enemy team.', winCondition: 'First team to the target score, or higher score at time.',
    tags: ['Allies', 'Squads', 'Respawns'], timed: true, scoreLimit: 20, durationSeconds: 240, npcCount: 4,
    respawnsEnabled: true, rounds: 1, teamMode: 'teams', supportsObjectives: false, supportsCompetitiveScore: true, defaultTeams: ['player', 'enemy'],
  },
  {
    id: 'domination', displayName: 'DOMINATION',
    description: 'Capture and hold three live control points while both teams fight for the map.',
    objective: 'Capture points and earn passive score while holding them.', winCondition: 'Reach the control score limit, or lead when time expires.',
    tags: ['Control Points', 'Team Score', 'Contested'], timed: true, scoreLimit: 100, durationSeconds: 240, npcCount: 4,
    respawnsEnabled: true, rounds: 1, teamMode: 'objectives', supportsObjectives: true, supportsCompetitiveScore: true, defaultTeams: ['player', 'enemy'],
  },
  {
    id: 'survival', displayName: 'ELIMINATION / SURVIVAL',
    description: 'Clear escalating enemy rounds with one life and controlled intermissions between encounters.',
    objective: 'Survive every hostile round.', winCondition: 'Clear all rounds before being eliminated.',
    tags: ['Rounds', 'One Life', 'Escalation'], timed: false, scoreLimit: 0, durationSeconds: 0, npcCount: 4,
    respawnsEnabled: false, rounds: 3, teamMode: 'survival', supportsObjectives: false, supportsCompetitiveScore: false, defaultTeams: ['enemy'],
  },
  {
    id: 'practice', displayName: 'TRAINING RANGE',
    description: 'Explore the selected arena, test the configured weapons, and reset the training encounter at any time.',
    objective: 'Practice movement, aim, weapons, and target damage without competitive pressure.', winCondition: 'No competitive winner; leave when ready.',
    tags: ['Targets', 'No Pressure', 'Weapon Lab'], timed: false, scoreLimit: 0, durationSeconds: 0, npcCount: 0,
    respawnsEnabled: false, rounds: 1, teamMode: 'practice', supportsObjectives: false, supportsCompetitiveScore: false, defaultTeams: ['player'],
  },
];

const modeMap = new Map(GAME_MODE_DEFINITIONS.map((definition) => [definition.id, definition]));

export function getGameModeDefinition(id: string): GameModeDefinition {
  return modeMap.get(id as GameModeId) ?? modeMap.get('practice')!;
}

export function listGameModes(): readonly GameModeDefinition[] {
  return GAME_MODE_DEFINITIONS;
}

export function createDefaultMatchSettings(modeId: GameModeId = 'practice', mapId = 'modern-city'): MatchSettings {
  const definition = getGameModeDefinition(modeId);
  return {
    modeId: definition.id,
    mapId,
    difficulty: 'normal' as DifficultyConfig['id'],
    durationSeconds: definition.durationSeconds,
    scoreLimit: definition.scoreLimit,
    npcCount: definition.npcCount,
    respawnsEnabled: definition.respawnsEnabled,
    rounds: definition.rounds,
    countdownSeconds: definition.teamMode === 'practice' ? 0 : 3,
  };
}

export function validateMatchSettings(settings: MatchSettings, availableMapIds: readonly string[]): MatchSettings {
  const definition = getGameModeDefinition(settings.modeId);
  const modeId = definition.id;
  const mapId = availableMapIds.includes(settings.mapId) ? settings.mapId : availableMapIds[0] ?? 'modern-city';
  const allowedDifficulty: readonly DifficultyConfig['id'][] = ['easy', 'normal', 'hard', 'expert'];
  const difficulty = allowedDifficulty.includes(settings.difficulty) ? settings.difficulty : 'normal';
  const maxNpcCount = modeId === 'practice' ? 0 : 8;
  const teams = modeId === 'team-deathmatch' || modeId === 'domination';
  const npcCount = clampInteger(settings.npcCount, teams ? 2 : 1, maxNpcCount, definition.npcCount);
  let duration = definition.timed ? clampInteger(settings.durationSeconds, 30, 900, definition.durationSeconds) : 0;
  const score = definition.supportsCompetitiveScore ? clampInteger(settings.scoreLimit, 0, 500, definition.scoreLimit) : 0;
  if (definition.timed && !duration && !score) duration = definition.durationSeconds;
  return {
    modeId,
    mapId,
    difficulty,
    durationSeconds: duration,
    scoreLimit: score,
    npcCount: modeId === 'practice' ? 0 : npcCount,
    respawnsEnabled: definition.respawnsEnabled,
    rounds: modeId === 'survival' ? clampInteger(settings.rounds, 1, 10, definition.rounds) : 1,
    countdownSeconds: modeId === 'practice' ? 0 : clampInteger(settings.countdownSeconds, 0, 10, 3),
  };
}

function clampInteger(value: number, minimum: number, maximum: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(Math.round(value), minimum), maximum) : fallback;
}
