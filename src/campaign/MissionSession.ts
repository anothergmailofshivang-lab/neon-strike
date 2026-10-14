import type { CampaignDifficulty, MissionCheckpoint, MissionDefinition, MissionEvent, MissionPhase, MissionResult, MissionSnapshot, MissionStatistics, ObjectiveSnapshot } from './CampaignTypes';
import { evaluateMissionRating } from './MissionResult';

type Position = { x: number; y: number; z: number };
interface EncounterState { state: 'inactive' | 'ready' | 'active' | 'completed' | 'cancelled'; members: Set<string>; defeated: Set<string>; }
let sequence = 0;
export function createMissionSessionId(): string { return `mission-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2)}`}`; }

/** Objective/encounter authority. World adapters supply actual positions, captures, and combat events. */
export class MissionSession {
  private phaseValue: MissionPhase = 'preparing';
  private resumePhase: 'active' | 'countdown' = 'countdown';
  private readonly objectives = new Map<string, ObjectiveSnapshot>();
  private readonly encounters = new Map<string, EncounterState>();
  private readonly listeners = new Set<(event: MissionEvent) => void>();
  private statistics: MissionStatistics = { seconds: 0, damageTaken: 0, eliminations: 0, retries: 0 };
  private resultValue: MissionResult | null = null;
  private checkpointValue: MissionCheckpoint | null = null;

  public constructor(public readonly definition: MissionDefinition, public readonly difficulty: CampaignDifficulty, public readonly sessionId = createMissionSessionId(), restore?: { checkpoint: MissionCheckpoint; carry: MissionStatistics }) {
    for (const objective of definition.objectives) this.objectives.set(objective.id, { id: objective.id, state: 'inactive', progress: 0, elapsed: 0 });
    for (const encounter of definition.encounters) this.encounters.set(encounter.id, { state: 'inactive', members: new Set(), defeated: new Set() });
    if (restore) {
      const checkpoint = restore.checkpoint;
      if (checkpoint.schemaVersion !== 1 || checkpoint.missionId !== definition.id || checkpoint.sessionId !== sessionId || !definition.checkpoints.some((c) => c.id === checkpoint.checkpointId)) throw new Error('Invalid checkpoint identity');
      if (Object.values(restore.carry).some((value) => !Number.isFinite(value) || value < 0) || new Set(checkpoint.completedObjectives).size !== checkpoint.completedObjectives.length || new Set(checkpoint.completedEncounters).size !== checkpoint.completedEncounters.length) throw new Error('Invalid checkpoint values');
      const milestone = definition.checkpoints.find((c) => c.id === checkpoint.checkpointId)!;
      const preceding = new Set<string>();
      const visit = (id: string): void => { if (preceding.has(id)) return; preceding.add(id); definition.objectives.find((o) => o.id === id)!.requires.forEach(visit); };
      visit(milestone.after);
      for (const id of checkpoint.completedObjectives) {
        const state = this.objectives.get(id), objective = definition.objectives.find((o) => o.id === id);
        if (!state || !objective || (!objective.optional && !preceding.has(id)) || objective.requires.some((key) => !checkpoint.completedObjectives.includes(key)) || (objective.encounterIds ?? []).some((key) => !checkpoint.completedEncounters.includes(key))) throw new Error('Invalid checkpoint objective graph');
        state.state = 'completed'; state.progress = 1;
      }
      if (!checkpoint.completedObjectives.includes(definition.checkpoints.find((c) => c.id === checkpoint.checkpointId)!.after)) throw new Error('Checkpoint milestone not complete');
      for (const id of checkpoint.completedEncounters) {
        const state = this.encounters.get(id), encounter = definition.encounters.find((e) => e.id === id);
        if (!state || !encounter || encounter.after.some((key) => !checkpoint.completedObjectives.includes(key) || key === milestone.after)) throw new Error('Invalid checkpoint encounter');
        state.state = 'completed';
      }
      this.statistics = { ...restore.carry, retries: restore.carry.retries + 1 };
      this.checkpointValue = structuredClone(checkpoint);
    }
  }
  public get phase(): MissionPhase { return this.phaseValue; }
  public get result(): MissionResult | null { return this.resultValue ? structuredClone(this.resultValue) : null; }
  public get checkpoint(): MissionCheckpoint | null { return this.checkpointValue ? structuredClone(this.checkpointValue) : null; }
  public subscribe(listener: (event: MissionEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  public prepare(): void { if (this.phase === 'preparing') this.phaseValue = 'countdown'; }
  public activate(): void { if (this.phase !== 'countdown') return; this.phaseValue = 'active'; this.advance(); }
  public pause(paused: boolean): void {
    if (paused && (this.phase === 'active' || this.phase === 'countdown')) { this.resumePhase = this.phase; this.phaseValue = 'paused'; }
    else if (!paused && this.phase === 'paused') this.phaseValue = this.resumePhase;
  }
  public isObjectiveActive(id: string): boolean { return this.phase === 'active' && ['active', 'contested'].includes(this.objectives.get(id)?.state ?? ''); }
  public isCompleted(id: string): boolean { return this.objectives.get(id)?.state === 'completed'; }
  public getReadyEncounters(): string[] { return [...this.encounters].filter(([, state]) => state.state === 'ready').map(([id]) => id); }
  public startEncounter(id: string, members: readonly string[]): boolean {
    const state = this.encounters.get(id), definition = this.definition.encounters.find((e) => e.id === id);
    if (this.phase !== 'active' || state?.state !== 'ready' || members.length !== definition?.units.length || new Set(members).size !== members.length) return false;
    state.state = 'active'; state.members = new Set(members); return true;
  }
  public defeated(entityId: string): void {
    if (this.phase !== 'active') return;
    if (entityId === 'player') { this.resolve('failure', 'Player eliminated'); return; }
    for (const [id, state] of this.encounters) {
      if (state.state !== 'active' || !state.members.has(entityId) || state.defeated.has(entityId)) continue;
      state.defeated.add(entityId); this.statistics.eliminations++;
      if (state.defeated.size === state.members.size) { state.state = 'completed'; this.emit({ type: 'encounter-completed', encounterId: id }); }
    }
    this.checkEncounterObjectives();
  }
  public damageTaken(amount: number): void { if (this.phase === 'active' && Number.isFinite(amount) && amount > 0) this.statistics.damageTaken += amount; }
  public interact(objectId: string): boolean {
    if (this.phase !== 'active') return false;
    const objective = this.definition.objectives.find((o) => o.objectId === objectId && this.isObjectiveActive(o.id));
    if (!objective) return false;
    this.complete(objective.id); return true;
  }
  public captured(pointId: string, owner: string | null, progress: number, contested: boolean): void {
    for (const objective of this.definition.objectives) if (objective.kind === 'capture' && objective.controlPointId === pointId && this.isObjectiveActive(objective.id)) {
      const state = this.objectives.get(objective.id)!;
      state.progress = owner === 'player' ? 1 : progress; state.state = contested ? 'contested' : 'active';
      if (owner === 'player' && !contested) this.complete(objective.id);
    }
  }
  public update(seconds: number, player: Position, hostiles: readonly Position[]): void {
    if (this.phase !== 'active') return;
    const delta = Number.isFinite(seconds) ? Math.min(Math.max(seconds, 0), 0.25) : 0;
    this.statistics.seconds += delta;
    for (const definition of this.definition.objectives) {
      if (!this.isObjectiveActive(definition.id)) continue;
      const state = this.objectives.get(definition.id)!;
      state.elapsed += delta;
      if (definition.timeout && state.elapsed >= definition.timeout) {
        state.state = 'failed'; this.emit({ type: 'objective-failed', objectiveId: definition.id });
        if (!definition.optional) this.resolve('failure', `Time limit expired: ${definition.title}`);
        continue;
      }
      const inside = definition.position ? inRegion(player, definition.position, definition.radius ?? 3) : false;
      const contested = definition.position ? hostiles.some((position) => inRegion(position, definition.position!, definition.radius ?? 3)) : false;
      if (definition.kind === 'reach' && inside || definition.kind === 'escape' && !inside) this.complete(definition.id);
      else if (['secure', 'defend', 'survive', 'extract'].includes(definition.kind)) {
        const progresses = definition.kind === 'survive' || inside && !contested;
        state.state = contested && inside && definition.kind !== 'survive' ? 'contested' : 'active';
        if (progresses) state.progress = Math.min(1, state.progress + delta / definition.duration!);
        else if (definition.kind === 'extract' || definition.kind === 'secure') state.progress = 0;
        if (state.progress >= 1 - 1e-8 && this.encountersDone(definition.encounterIds ?? [])) this.complete(definition.id);
      }
    }
    this.checkEncounterObjectives(); this.advance();
  }
  public fail(reason: string): void { if (this.phase === 'active' || this.phase === 'countdown') this.resolve('failure', reason); }
  public abort(): void { if (!['success', 'failure', 'aborted'].includes(this.phase)) this.resolve('aborted', 'Operation aborted'); }
  public dispose(): void { this.abort(); this.listeners.clear(); }
  public snapshot(): MissionSnapshot { return { sessionId: this.sessionId, missionId: this.definition.id, phase: this.phase, objectives: [...this.objectives.values()].map((o) => ({ ...o })), statistics: { ...this.statistics }, checkpointId: this.checkpointValue?.checkpointId ?? null, result: this.result }; }
  private encountersDone(ids: readonly string[]): boolean { return ids.every((id) => this.encounters.get(id)?.state === 'completed'); }
  private checkEncounterObjectives(): void {
    for (const definition of this.definition.objectives) if (definition.kind === 'eliminate' && this.isObjectiveActive(definition.id)) {
      const states = (definition.encounterIds ?? []).map((id) => this.encounters.get(id)!);
      const count = states.reduce((n, state) => n + state.defeated.size, 0);
      const total = this.definition.encounters.filter((e) => definition.encounterIds?.includes(e.id)).reduce((n, e) => n + e.units.length, 0);
      this.objectives.get(definition.id)!.progress = total ? count / total : 0;
      if (this.encountersDone(definition.encounterIds ?? [])) this.complete(definition.id);
    }
  }
  private complete(id: string): void {
    if (!this.isObjectiveActive(id)) return;
    const state = this.objectives.get(id)!; state.state = 'completed'; state.progress = 1;
    this.emit({ type: 'objective-completed', objectiveId: id });
    // Capture a quiet milestone before its newly enabled encounter can be spawned.
    const checkpoint = this.definition.checkpoints.find((c) => c.after === id);
    if (checkpoint && ![...this.encounters.values()].some((e) => e.state === 'active')) {
      this.checkpointValue = { schemaVersion: 1, checkpointId: checkpoint.id, missionId: this.definition.id, sessionId: this.sessionId, completedObjectives: [...this.objectives.values()].filter((o) => o.state === 'completed').map((o) => o.id), completedEncounters: [...this.encounters].filter(([, e]) => e.state === 'completed').map(([key]) => key) };
      this.emit({ type: 'checkpoint', checkpoint: this.checkpoint! });
    }
    if (this.definition.objectives.every((o) => o.optional || this.isCompleted(o.id))) this.resolve('success', 'Mandatory objectives complete; extraction secured');
    else this.advance();
  }
  private advance(): void {
    if (this.phase !== 'active') return;
    for (const definition of this.definition.objectives) {
      const state = this.objectives.get(definition.id)!;
      if (state.state === 'inactive' && definition.requires.every((id) => this.isCompleted(id))) { state.state = 'active'; this.emit({ type: 'objective-activated', objectiveId: definition.id }); }
    }
    for (const definition of this.definition.encounters) {
      const state = this.encounters.get(definition.id)!;
      if (state.state === 'inactive' && definition.after.every((id) => this.isCompleted(id))) { state.state = 'ready'; this.emit({ type: 'encounter-ready', encounterId: definition.id }); }
    }
  }
  private resolve(outcome: MissionResult['outcome'], reason: string): void {
    if (['success', 'failure', 'aborted'].includes(this.phase)) return;
    this.phaseValue = outcome;
    for (const state of this.objectives.values()) if (state.state !== 'completed' && state.state !== 'failed') state.state = 'cancelled';
    for (const state of this.encounters.values()) if (state.state !== 'completed') state.state = 'cancelled';
    const result: MissionResult = { sessionId: this.sessionId, campaignId: this.definition.campaignId, missionId: this.definition.id, difficulty: this.difficulty, outcome, reason, rating: 'none', completedObjectives: [...this.objectives.values()].filter((o) => o.state === 'completed').map((o) => o.id), optionalObjectives: this.definition.objectives.filter((o) => o.optional && this.isCompleted(o.id)).map((o) => o.id), statistics: { ...this.statistics } };
    result.rating = evaluateMissionRating(this.definition, result); this.resultValue = result;
    this.emit({ type: 'resolved', result: structuredClone(result) });
  }
  private emit(event: MissionEvent): void { for (const listener of this.listeners) listener(event); }
}

function inRegion(position: Position, center: readonly number[], radius: number): boolean { return Math.abs(position.y - center[1]) < 2 && Math.hypot(position.x - center[0], position.z - center[2]) <= radius; }
