import type { DifficultyConfig } from '../ai/NPCDifficulty';
import type { NPCArchetypeDefinition } from '../ai/NPCDefinitions';
import type { MapVector3 } from '../world/MapDefinition';

export type CampaignDifficulty = DifficultyConfig['id'];
export type ObjectiveKind = 'reach' | 'escape' | 'eliminate' | 'secure' | 'capture' | 'interact' | 'recover' | 'activate' | 'defend' | 'survive' | 'extract';
export type ObjectiveState = 'inactive' | 'active' | 'contested' | 'completed' | 'failed' | 'cancelled';
export type MissionPhase = 'preparing' | 'countdown' | 'active' | 'paused' | 'success' | 'failure' | 'aborted';
export type MissionRating = 'none' | 'bronze' | 'silver' | 'gold' | 'elite';

export interface MissionObjectiveDefinition {
  id: string;
  title: string;
  kind: ObjectiveKind;
  requires: readonly string[];
  optional?: boolean;
  position?: MapVector3;
  radius?: number;
  duration?: number;
  timeout?: number;
  objectId?: string;
  controlPointId?: string;
  encounterIds?: readonly string[];
}

export interface MissionObjectDefinition {
  id: string;
  label: string;
  kind: 'terminal' | 'item';
  position: MapVector3;
  initialActive?: boolean;
  action?: 'enable' | 'disable' | 'collect';
  opensDoorId?: string;
}

export interface MissionEncounterDefinition {
  id: string;
  after: readonly string[];
  units: readonly { id: string; spawnId: string; archetype: NPCArchetypeDefinition['id'] }[];
  destination: MapVector3;
}

export interface MissionDefinition {
  id: string;
  campaignId: string;
  chapter: string;
  name: string;
  summary: string;
  briefing: string;
  debrief: string;
  mapId: string;
  spawnId: string;
  requires: readonly string[];
  suggestedEquipment: string;
  objectives: readonly MissionObjectiveDefinition[];
  objects: readonly MissionObjectDefinition[];
  encounters: readonly MissionEncounterDefinition[];
  checkpoints: readonly { id: string; after: string; position: MapVector3; yaw: number }[];
  firstCompletionXp: number;
  timeGoal?: number;
}

export interface ObjectiveSnapshot {
  id: string;
  state: ObjectiveState;
  progress: number;
  elapsed: number;
}
export interface MissionStatistics { seconds: number; damageTaken: number; eliminations: number; retries: number; }
export interface MissionResult {
  sessionId: string;
  missionId: string;
  campaignId: string;
  difficulty: CampaignDifficulty;
  outcome: 'success' | 'failure' | 'aborted';
  reason: string;
  rating: MissionRating;
  completedObjectives: string[];
  optionalObjectives: string[];
  statistics: MissionStatistics;
}
/** Safe milestone only; never persisted across application reload. */
export interface MissionCheckpoint {
  schemaVersion: 1;
  missionId: string;
  sessionId: string;
  checkpointId: string;
  completedObjectives: string[];
  completedEncounters: string[];
}
export interface MissionSnapshot {
  sessionId: string;
  missionId: string;
  phase: MissionPhase;
  objectives: ObjectiveSnapshot[];
  statistics: MissionStatistics;
  checkpointId: string | null;
  result: MissionResult | null;
}
export type MissionEvent =
  | { type: 'objective-activated' | 'objective-completed' | 'objective-failed'; objectiveId: string }
  | { type: 'encounter-ready' | 'encounter-completed'; encounterId: string }
  | { type: 'checkpoint'; checkpoint: MissionCheckpoint }
  | { type: 'resolved'; result: MissionResult };

export interface MissionRecord {
  missionId: string;
  completedAt: string | null;
  best: MissionResult | null;
  optionalObjectives: string[];
  successes: number;
  failures: number;
  aborts: number;
}
export interface CampaignProgress {
  schemaVersion: 1;
  selectedMissionId: string;
  difficulty: CampaignDifficulty;
  records: Record<string, MissionRecord>;
  milestones: string[];
  recentResults: (MissionResult & { timestamp: string })[];
  /** Bounded recent run ledger; first-completion ownership lives in permanent records. */
  processedRuns: string[];
}
