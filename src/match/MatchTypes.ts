import type { DifficultyConfig } from '../ai/NPCDifficulty';

export type GameModeId = 'free-for-all' | 'team-deathmatch' | 'domination' | 'survival' | 'practice';
export type TeamId = 'player' | 'enemy' | `ffa:${string}`;
export type MatchOutcome = 'victory' | 'defeat' | 'draw' | 'practice-complete';
export type MatchPhase = 'preparing' | 'countdown' | 'active' | 'paused' | 'intermission' | 'completed' | 'aborted';

export interface MatchSettings {
  modeId: GameModeId;
  mapId: string;
  difficulty: DifficultyConfig['id'];
  durationSeconds: number;
  scoreLimit: number;
  npcCount: number;
  respawnsEnabled: boolean;
  rounds: number;
  countdownSeconds: number;
}

export interface MatchParticipantStats {
  eliminations: number;
  deaths: number;
  damageDealt: number;
  damageReceived: number;
  shotsFired: number;
  shotsHit: number;
  criticalHits: number;
  objectiveScore: number;
  objectiveCaptures: number;
  totalScore: number;
}

export interface MatchParticipant {
  id: string;
  displayName: string;
  teamId: TeamId;
  kind: 'player' | 'npc';
  archetype?: string;
  alive: boolean;
  lifeToken: number;
  stats: MatchParticipantStats;
}

export interface MatchObjectiveState {
  id: string;
  displayName: string;
  owner: TeamId | null;
  capturingTeam: TeamId | null;
  progress: number;
  contested: boolean;
  scoreAccumulator: number;
}

export interface MatchSnapshot {
  sessionId: string;
  settings: MatchSettings;
  phase: MatchPhase;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  countdownRemaining: number;
  round: number;
  roundCount: number;
  teamScores: Readonly<Record<string, number>>;
  participants: readonly MatchParticipant[];
  objectives: readonly MatchObjectiveState[];
  outcome: MatchOutcome | null;
  winnerTeamId: TeamId | null;
  resolutionReason: string | null;
}

export type MatchEvent =
  | { type: 'countdown-started'; seconds: number }
  | { type: 'match-started' }
  | { type: 'score-changed'; teamId: TeamId; amount: number; reason: string }
  | { type: 'participant-eliminated'; sourceId: string | null; targetId: string; teamId: TeamId; credited: boolean }
  | { type: 'objective-captured'; objectiveId: string; teamId: TeamId; contributorIds: readonly string[] }
  | { type: 'objective-changed'; objective: MatchObjectiveState }
  | { type: 'round-started'; round: number }
  | { type: 'round-ended'; round: number; outcome: MatchOutcome }
  | { type: 'match-completed'; outcome: MatchOutcome; winnerTeamId: TeamId | null; reason: string };

export type MatchEventListener = (event: MatchEvent) => void;

export function createParticipantStats(): MatchParticipantStats {
  return {
    eliminations: 0,
    deaths: 0,
    damageDealt: 0,
    damageReceived: 0,
    shotsFired: 0,
    shotsHit: 0,
    criticalHits: 0,
    objectiveScore: 0,
    objectiveCaptures: 0,
    totalScore: 0,
  };
}

export function cloneMatchSettings(settings: MatchSettings): MatchSettings {
  return { ...settings };
}
