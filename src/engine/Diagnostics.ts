import type { ApplicationState } from '../app/GameState';
import type { InputManager } from './InputManager';
import type { GameLoopMetrics } from './GameLoop';
import type { RendererStats } from './Renderer';
import type { PlayerSnapshot } from '../player/PlayerState';
import type { WeaponHudState } from '../weapons/WeaponTypes';
import type { NPCEncounterSummary } from '../ai/NPCManager';

export interface DiagnosticsSources {
  getState: () => ApplicationState;
  getLoopMetrics: () => GameLoopMetrics;
  getRendererStats: () => RendererStats;
  getInput: () => InputManager;
  getPlayer: () => PlayerSnapshot | null;
  getWeapon: () => WeaponHudState | null;
  getNPCs: () => NPCEncounterSummary | null;
}

export class Diagnostics {
  private readonly root: HTMLDivElement;
  private readonly values: HTMLPreElement;
  private readonly sources: DiagnosticsSources;
  private readonly refreshIntervalMs: number;
  private enabled: boolean;
  private lastUpdate = -Infinity;

  public constructor(
    container: HTMLElement,
    enabledByDefault: boolean,
    refreshIntervalMs: number,
    sources: DiagnosticsSources,
  ) {
    this.sources = sources;
    this.refreshIntervalMs = refreshIntervalMs;
    this.enabled = enabledByDefault;
    this.root = document.createElement('div');
    this.root.className = 'diagnostics-panel';
    this.root.setAttribute('aria-live', 'off');
    this.values = document.createElement('pre');
    this.values.className = 'diagnostics-values';
    this.root.appendChild(this.values);
    container.appendChild(this.root);
    this.applyVisibility();
  }

  public get isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.applyVisibility();
    if (enabled) {
      this.lastUpdate = -Infinity;
    }
  }

  public toggle(): void {
    this.setEnabled(!this.enabled);
  }

  public update(timestampMs: number): void {
    if (!this.enabled || timestampMs - this.lastUpdate < this.refreshIntervalMs) {
      return;
    }

    this.lastUpdate = timestampMs;
    const metrics = this.sources.getLoopMetrics();
    const renderer = this.sources.getRendererStats();
    const input = this.sources.getInput();
    this.values.textContent = this.format(
      metrics,
      renderer,
      input,
      this.sources.getPlayer(),
      this.sources.getWeapon(),
      this.sources.getNPCs(),
    );
  }

  public dispose(): void {
    this.root.remove();
  }

  private format(
    metrics: GameLoopMetrics,
    renderer: RendererStats,
    input: InputManager,
    player: PlayerSnapshot | null,
    weapon: WeaponHudState | null,
    npcs: NPCEncounterSummary | null,
  ): string {
    const formatNumber = (value: number, digits = 1): string => Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
    const formatNullable = (value: number | null): string => value === null ? 'n/a' : String(value);
    const visibility = typeof document === 'undefined' ? 'unknown' : document.visibilityState;
    const heldKeys = input.getHeldKeys().join(', ') || 'none';
    const playerLines = player ? [
      `PLAYER      ${this.formatVector(player.position)} m`,
      `VELOCITY    ${this.formatVector(player.velocity)} m/s (${formatNumber(player.horizontalSpeed, 2)} h)`,
      `MOVE        ${player.movementState} / grounded ${player.grounded ? 'yes' : 'no'}`,
      `LOOK        yaw ${this.toDegrees(player.yaw).toFixed(1)}° / pitch ${this.toDegrees(player.pitch).toFixed(1)}°`,
      `LOCK        ${player.pointerLocked ? 'locked' : 'released'} / collisions ${player.collisionCount}`,
    ] : ['PLAYER      unavailable'];
    const weaponLines = weapon ? [
      `WEAPON      ${weapon.displayName}`,
      `AMMO        ${weapon.magazineAmmo} / ${weapon.reserveAmmo} (${weapon.state})`,
    ] : ['WEAPON      unavailable'];
    const npcLines = npcs ? [
      `NPCS        ${npcs.active}/${npcs.total} active / ${npcs.defeated} defeated`,
      `AI STATES    ${Object.entries(npcs.states).map(([state, count]) => `${state}:${count}`).join(', ') || 'none'}`,
    ] : ['NPCS        unavailable'];
    return [
      `STATE       ${this.sources.getState()}`,
      `FPS         ${formatNumber(metrics.fps, 1)}`,
      `FRAME       ${formatNumber(metrics.frameTimeMs, 2)} ms (avg ${formatNumber(metrics.averageFrameTimeMs, 2)} ms)`,
      `SIM         ${metrics.simulationSteps} step(s), ${formatNumber(metrics.simulationTimeMs, 2)} ms`,
      `RENDER      ${formatNumber(metrics.renderTimeMs, 2)} ms`,
      `CANVAS      ${renderer.width} x ${renderer.height} @ ${formatNumber(renderer.pixelRatio, 2)}x`,
      `DRAW        ${formatNullable(renderer.drawCalls)} calls / ${formatNullable(renderer.geometries)} geometries`,
      `INPUT       ${input.isActive ? 'active' : 'inactive'} (${heldKeys})`,
      `VISIBILITY  ${visibility}`,
      `DROPPED     ${formatNumber(metrics.droppedTimeSeconds, 3)} s`,
      ...playerLines,
      ...weaponLines,
      ...npcLines,
    ].join('\n');
  }

  private formatVector(vector: { x: number; y: number; z: number }): string {
    return `${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}, ${vector.z.toFixed(2)}`;
  }

  private toDegrees(radians: number): number {
    return radians * 180 / Math.PI;
  }

  private applyVisibility(): void {
    this.root.hidden = !this.enabled;
  }
}
