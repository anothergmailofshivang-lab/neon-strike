import { getGameModeDefinition, validateMatchSettings } from './GameModeDefinitions';
import { createParticipantStats, type MatchEvent, type MatchEventListener, type MatchObjectiveState, type MatchOutcome, type MatchParticipant, type MatchSettings, type MatchSnapshot, type TeamId } from './MatchTypes';

let sessionSequence = 0;

/** Authoritative transient match state. All time arrives from the existing fixed-step loop. */
export class MatchSession {
  public readonly sessionId: string;
  public readonly settings: Readonly<MatchSettings>;
  private readonly participants = new Map<string, MatchParticipant>();
  private readonly scores = new Map<TeamId, number>();
  private readonly objectives = new Map<string, MatchObjectiveState>();
  private readonly listeners = new Set<MatchEventListener>();
  private phaseValue: MatchSnapshot['phase'] = 'preparing';
  private suspendedPhase: MatchSnapshot['phase'] | null = null;
  private elapsed = 0;
  private countdown = 0;
  private intermission = 0;
  private round = 1;
  private outcome: MatchOutcome | null = null;
  private winner: TeamId | null = null;
  private reason: string | null = null;
  public constructor(settings: MatchSettings, sessionId = `match-${Date.now()}-${++sessionSequence}`) {
    this.settings = Object.freeze(validateMatchSettings(settings, [settings.mapId]));
    this.sessionId = sessionId;
  }
  public get modeId() { return this.settings.modeId; }
  public get phase() { return this.phaseValue; }
  public get isResolved() { return this.phase === 'completed' || this.phase === 'aborted'; }
  public get intermissionSecondsRemaining() { return this.intermission; }
  public get isCompetitive() { return getGameModeDefinition(this.modeId).supportsCompetitiveScore; }
  public subscribe(listener: MatchEventListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  public start(): void {
    if (this.phase !== 'preparing') return;
    if (!this.participants.has('player')) throw new Error('Match requires a player.');
    this.beginCountdown();
  }
  public update(seconds: number): void {
    const delta = Number.isFinite(seconds) ? Math.min(Math.max(seconds, 0), 0.25) : 0;
    if (this.phase === 'intermission') { this.intermission = Math.max(this.intermission - delta, 0); return; }
    if (this.phase === 'countdown') {
      this.countdown = Math.max(this.countdown - delta, 0);
      if (this.countdown < 1e-8) this.beginActive();
      return;
    }
    if (this.phase !== 'active') return;
    this.elapsed += delta;
    if (this.settings.durationSeconds > 0 && this.elapsed >= this.settings.durationSeconds) {
      this.elapsed = this.settings.durationSeconds;
      this.resolveStandings('Time expired');
    }
  }
  public setPaused(paused: boolean): void {
    if (paused && ['countdown', 'active', 'intermission'].includes(this.phase)) {
      this.suspendedPhase = this.phase; this.phaseValue = 'paused';
    } else if (!paused && this.phase === 'paused' && this.suspendedPhase) {
      this.phaseValue = this.suspendedPhase; this.suspendedPhase = null;
    }
  }
  public addParticipant(value: Omit<MatchParticipant, 'stats' | 'alive' | 'lifeToken'>): void {
    if (this.participants.has(value.id)) throw new Error(`Duplicate participant: ${value.id}`);
    this.participants.set(value.id, { ...value, stats: createParticipantStats(), alive: true, lifeToken: 0 });
    if (!this.scores.has(value.teamId)) this.scores.set(value.teamId, 0);
  }
  public getParticipant(id: string): MatchParticipant | null {
    const p = this.participants.get(id); return p ? { ...p, stats: { ...p.stats } } : null;
  }
  public getParticipants(): readonly MatchParticipant[] { return [...this.participants.keys()].map((id) => this.getParticipant(id)!); }
  public areOpponents(source: string, target: string): boolean {
    const a = this.participants.get(source), b = this.participants.get(target);
    return Boolean(a && b && a.id !== b.id && a.teamId !== b.teamId);
  }
  public recordShot(sourceId: string, count = 1): void {
    if (this.phase !== 'active') return;
    const p = this.participants.get(sourceId);
    if (p?.alive && Number.isFinite(count)) p.stats.shotsFired += Math.max(count, 0);
  }
  public recordDamage(sourceId: string, targetId: string, amount: number): void {
    if (this.phase !== 'active' || !Number.isFinite(amount) || amount <= 0) return;
    const source = this.participants.get(sourceId), target = this.participants.get(targetId);
    if (target) target.stats.damageReceived += amount;
    if (source) { source.stats.damageDealt += amount; source.stats.shotsHit += 1; }
  }
  public recordElimination(sourceId: string | null, targetId: string, lifeToken?: number): boolean {
    const target = this.participants.get(targetId);
    if (this.phase !== 'active' || !target?.alive || (lifeToken !== undefined && lifeToken !== target.lifeToken)) return false;
    const source = sourceId ? this.participants.get(sourceId) : null;
    if (source && source.id !== target.id && source.teamId === target.teamId) return false;
    target.alive = false; target.stats.deaths++;
    const credited = Boolean(source && source.id !== target.id);
    if (credited && source) { source.stats.eliminations++; source.stats.totalScore++; }
    this.emit({ type: 'participant-eliminated', sourceId: credited ? sourceId : null, targetId, teamId: target.teamId, credited });
    if (credited && source && ['free-for-all', 'team-deathmatch'].includes(this.modeId)) this.addTeamScore(source.teamId, 1, 'elimination');
    if (this.modeId === 'survival') {
      if (target.kind === 'player') this.resolve('Player eliminated', null, 'defeat');
      else if (this.getParticipants().filter((p) => p.kind === 'npc').every((p) => !p.alive)) {
        this.emit({ type: 'round-ended', round: this.round, outcome: 'victory' });
        if (this.round >= this.settings.rounds) this.resolve('All rounds cleared', 'player', 'victory');
        else { this.phaseValue = 'intermission'; this.intermission = 2.5; }
      }
    }
    return true;
  }
  public respawnParticipant(id: string): boolean {
    const p = this.participants.get(id);
    if (!this.settings.respawnsEnabled || this.phase !== 'active' || !p || p.alive) return false;
    p.alive = true; p.lifeToken++; return true;
  }
  public startNextRound(): boolean {
    if (this.modeId !== 'survival' || this.phase !== 'intermission' || this.intermission > 1e-8 || this.round >= this.settings.rounds) return false;
    this.round++;
    for (const p of this.participants.values()) if (p.kind === 'npc') { p.alive = true; p.lifeToken++; }
    this.emit({ type: 'round-started', round: this.round });
    this.beginCountdown(); return true;
  }
  public resetRoundParticipants(): void {
    for (const participant of this.participants.values()) if (participant.kind === 'npc') participant.alive = true;
  }
  public addTeamScore(teamId: TeamId, amount: number, reason: string): boolean {
    if (this.phase !== 'active' || !this.isCompetitive || !Number.isFinite(amount) || amount <= 0) return false;
    this.scores.set(teamId, (this.scores.get(teamId) ?? 0) + amount);
    this.emit({ type: 'score-changed', teamId, amount, reason });
    if (this.settings.scoreLimit > 0 && this.scores.get(teamId)! >= this.settings.scoreLimit) this.resolve('Score limit reached', teamId);
    return true;
  }
  /** Objective ticks are simultaneous: ties on the winning tick produce a draw. */
  public awardObjectiveTick(awards: ReadonlyMap<TeamId, number>, contributors: ReadonlyMap<TeamId, readonly string[]> = new Map()): void {
    if (this.phase !== 'active') return;
    for (const [team, amount] of awards) {
      this.scores.set(team, (this.scores.get(team) ?? 0) + amount);
      this.emit({ type: 'score-changed', teamId: team, amount, reason: 'objective hold' });
      for (const id of contributors.get(team) ?? []) {
        const participant = this.participants.get(id);
        if (participant) { participant.stats.objectiveScore += amount; participant.stats.totalScore += amount; }
      }
    }
    if (this.settings.scoreLimit > 0 && [...this.scores.values()].some((s) => s >= this.settings.scoreLimit)) this.resolveStandings('Control score limit reached');
  }
  public addObjective(value: MatchObjectiveState): void {
    if (this.objectives.has(value.id)) throw new Error(`Duplicate objective: ${value.id}`);
    this.objectives.set(value.id, { ...value });
  }
  public updateObjective(value: MatchObjectiveState, notify = false, capturers: readonly string[] = []): void {
    if (this.phase !== 'active') return;
    this.objectives.set(value.id, { ...value });
    for (const id of capturers) {
      const p = this.participants.get(id);
      if (p?.alive) { p.stats.objectiveScore++; p.stats.totalScore++; }
    }
    if (notify) this.emit({ type: 'objective-changed', objective: { ...value } });
  }
  public resolve(reason: string, winner: TeamId | null, outcome?: MatchOutcome): void {
    if (this.isResolved) return;
    this.phaseValue = 'completed'; this.winner = winner; this.reason = reason;
    this.outcome = outcome ?? (this.modeId === 'practice' ? 'practice-complete' : winner === null ? 'draw' : winner === 'player' ? 'victory' : 'defeat');
    this.emit({ type: 'match-completed', outcome: this.outcome, winnerTeamId: winner, reason });
  }
  public abort(): void { if (!this.isResolved) this.phaseValue = 'aborted'; this.listeners.clear(); }
  public snapshot(): MatchSnapshot {
    return { sessionId: this.sessionId, settings: { ...this.settings }, phase: this.phase, elapsedSeconds: this.elapsed,
      remainingSeconds: this.settings.durationSeconds > 0 ? Math.max(this.settings.durationSeconds - this.elapsed, 0) : null,
      countdownRemaining: this.countdown, round: this.round, roundCount: this.settings.rounds,
      teamScores: Object.fromEntries(this.scores), participants: this.getParticipants(), objectives: [...this.objectives.values()].map((o) => ({ ...o })),
      outcome: this.outcome, winnerTeamId: this.winner, resolutionReason: this.reason };
  }
  private beginCountdown(): void {
    this.phaseValue = 'countdown'; this.countdown = this.settings.countdownSeconds;
    this.emit({ type: 'countdown-started', seconds: this.countdown });
    if (!this.countdown) this.beginActive();
  }
  private beginActive(): void { this.countdown = 0; this.phaseValue = 'active'; this.emit({ type: 'match-started' }); }
  private resolveStandings(reason: string): void {
    const standings = [...this.scores.entries()].sort((a, b) => b[1] - a[1]);
    const winner = standings.length && (standings.length === 1 || standings[0][1] > standings[1][1]) ? standings[0][0] : null;
    this.resolve(reason, winner);
  }
  private emit(event: MatchEvent): void { for (const listener of this.listeners) listener(event); }
}
