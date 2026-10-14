// @vitest-environment happy-dom
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameApp } from '../src/app/GameApp';
import { GameLoop } from '../src/engine/GameLoop';
import { ApplicationState, type GameStateMachine } from '../src/app/GameState';
import type { MissionSession } from '../src/campaign/MissionSession';
import type { NPCManager } from '../src/ai/NPCManager';
import type { DamageSystem } from '../src/combat/DamageSystem';
import type { PlayerHealth } from '../src/player/PlayerHealth';
import type { PlayerController } from '../src/player/PlayerController';
import type { InteractionManager } from '../src/tactical/InteractionManager';
import type { TacticalEquipmentService } from '../src/tactical/TacticalEquipmentService';
import type { MatchSession } from '../src/match/MatchSession';
import type { CombatEventBus } from '../src/combat/CombatEvents';
import type { ProgressionService } from '../src/progression/ProgressionService';
import type { MapManager } from '../src/world/MapManager';
import { getWeaponDefinition } from '../src/weapons/WeaponDefinitions';

// Exercise the actual GameApp/DOM/physics wiring; only GPU rendering and browser capture are adapted.
vi.mock('../src/engine/Renderer', () => ({ Renderer: class {
  public canvas = document.createElement('canvas');
  constructor(container: HTMLElement) { container.append(this.canvas); this.canvas.requestPointerLock = async () => { Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: this.canvas }); document.dispatchEvent(new Event('pointerlockchange')); }; }
  resize() { return false; } render() {} renderPreview() {}
  getStats() { return { width: 800, height: 600, pixelRatio: 1, drawCalls: 0, geometries: 0, textures: 0 }; }
  dispose() { this.canvas.remove(); }
} }));

interface Harness {
  stateMachine: GameStateMachine; mission: MissionSession; npcManager: NPCManager; damageSystem: DamageSystem; playerHealth: PlayerHealth; player: PlayerController;
  interactions: InteractionManager; tacticalEquipment: TacticalEquipmentService; matchSession: MatchSession; combatEvents: CombatEventBus; progressionService: ProgressionService; mapManager: MapManager;
  update: (seconds: number) => void; showCurrentResults: () => void;
}
let app: GameApp, h: Harness, root: HTMLElement;
function click(text: string): void { const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === text && !b.closest('[hidden]')); expect(found, text).toBeDefined(); found!.click(); }
function tick(seconds: number): void { for (let i = 0; i < Math.ceil(seconds * 10); i++) h.update(0.1); }
function move(point: readonly [number, number, number]): void { h.player.reset(point, 0); tick(0.2); }
function interact(id: string): void {
  const object = h.mission.definition.objects.find((o) => o.id === id)!;
  move([object.position[0], 0.04, object.position[2] - 1.8]);
  const eye = h.player.getRoot().position.clone().add(new THREE.Vector3(0, 1.6, 0));
  expect(h.interactions.interact(eye, new THREE.Vector3(...object.position).sub(eye).normalize())).toContain(object.label);
}
function clearGuards(): void {
  for (const npc of h.npcManager.getSnapshots()) {
    const target = h.damageSystem.getTarget(npc.id)!, weapon = getWeaponDefinition('sniper-rifle');
    for (let i = 0; i < 8 && !target.isDefeated; i++) {
      h.combatEvents.emit({ type: 'weapon-fired', sourceId: 'player', weapon, shotCount: 1 });
      h.damageSystem.applyWeaponHit(target, weapon, 'body', 1, target.root.position, new THREE.Vector3(0, 0, -1), 0, 1, 'player');
    }
  }
}
function destroyCrate(): void {
  const crate = h.damageSystem.getTarget('city-crate-alley')!;
  h.damageSystem.applyWeaponHit(crate, getWeaponDefinition('sniper-rifle'), 'body', 1, crate.root.position, new THREE.Vector3(0, 0, -1), 0, 1, 'player');
  expect(crate.isDefeated).toBe(true);
}

describe('campaign AppShell and GameApp integration', () => {
  beforeEach(async () => {
    localStorage.clear(); document.body.replaceChildren(); root = document.createElement('div'); document.body.append(root);
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: null });
    document.exitPointerLock = () => { Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: null }); document.dispatchEvent(new Event('pointerlockchange')); };
    vi.spyOn(GameLoop.prototype, 'start').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    app = new GameApp(root); h = app as unknown as Harness; await app.start();
    expect(h.stateMachine.state).toBe(ApplicationState.MAIN_MENU);
  });
  afterEach(() => { app?.dispose(); vi.restoreAllMocks(); document.body.replaceChildren(); });

  it('launches only unlocked missions with the selected difficulty, pauses, aborts and rejects old sources', () => {
    click('Campaign · Carrier Zero');
    expect(root.querySelectorAll('.campaign-card')).toHaveLength(10);
    expect(root.querySelectorAll('.campaign-card:disabled')).toHaveLength(9);
    const locked = root.querySelector<HTMLButtonElement>('[data-mission-id="last-carrier"]')!; locked.click();
    expect(root.querySelector('.campaign-briefing h2')?.textContent).toBe('Dead Air');
    const difficulty = root.querySelector<HTMLSelectElement>('[aria-label="Campaign difficulty"]')!; difficulty.value = 'hard'; difficulty.dispatchEvent(new Event('change'));
    click('Deploy'); tick(3.2);
    expect(h.mission.phase).toBe('active'); expect(h.matchSession.settings.difficulty).toBe('hard'); expect(h.mapManager.current?.definition.id).toBe('modern-city');
    move([0, 0.04, 9]); expect(h.npcManager.getSnapshots()).toHaveLength(2);
    const oldId = h.npcManager.getSnapshots()[0].id, oldMission = h.mission;
    click('Pause'); const elapsed = h.mission.snapshot().statistics.seconds; tick(5); expect(h.mission.phase).toBe('paused'); expect(h.mission.snapshot().statistics.seconds).toBe(elapsed);
    click('Resume'); expect(h.mission.phase).toBe('active'); click('Pause'); click('Return to Menu');
    expect(oldMission.phase).toBe('aborted'); expect(h.progressionService.profile.campaign.records['dead-air'].aborts).toBe(1); expect(h.progressionService.profile.lifetimeXp).toBe(0);
    click('Campaign · Carrier Zero'); click('Deploy'); tick(3.2);
    expect(h.mission.sessionId).not.toBe(oldMission.sessionId); expect(h.npcManager.getSnapshots()).toHaveLength(0);
    const result = h.damageSystem.applyDirectDamage(h.playerHealth, 100, oldId, 'frag-grenade', new THREE.Vector3(), 10);
    expect(result.applied).toBe(false); expect(h.playerHealth.health).toBe(100);
  }, 20000);

  it('restores a safe checkpoint, removes old projectiles/NPCs, then extracts and commits once', () => {
    click('Campaign · Carrier Zero'); click('Deploy'); tick(3.2); move([0, 0.04, 9]); destroyCrate(); clearGuards();
    expect(h.mission.checkpoint).not.toBeNull(); const id = h.mission.sessionId;
    interact('market-reader'); interact('trace');
    expect(h.tacticalEquipment.usePlayer('tactical', new THREE.Vector3(0, 1.6, 7), new THREE.Vector3(0, 1, 0), 'survival').accepted).toBe(true);
    h.damageSystem.applyDirectDamage(h.playerHealth, 100, 'player', 'frag-grenade', h.player.getRoot().position, 4);
    expect(h.stateMachine.state).toBe(ApplicationState.MATCH_RESULTS); expect(root.querySelector('.results-overlay h2')?.textContent).toContain('MISSION FAILED');
    click('Retry Checkpoint'); tick(3.2);
    expect(h.mission.sessionId).toBe(id); expect(h.mission.snapshot().statistics.retries).toBe(1); expect(h.mission.isCompleted('guards')).toBe(true); expect(h.mission.isCompleted('reader')).toBe(false);
    expect(h.playerHealth.health).toBe(100); expect(h.tacticalEquipment.activeProjectileCount).toBe(0); expect(h.tacticalEquipment.getSnapshot('tactical')?.charges).toBe(2); expect(h.npcManager.getSnapshots()).toHaveLength(0);
    destroyCrate();
    interact('market-reader'); interact('trace'); move([2, 0.04, -14]); tick(3.2);
    expect(h.stateMachine.state).toBe(ApplicationState.MATCH_RESULTS); expect(root.querySelector('.results-overlay h2')?.textContent).toContain('MISSION SUCCESS');
    const profile = h.progressionService.profile; expect(profile.campaign.records['dead-air'].completedAt).toBeTruthy(); expect(profile.campaign.processedRuns).toEqual([id]); expect(profile.weaponMastery['sniper-rifle'].eliminations).toBe(2);
    expect(profile.career.propsDestroyed).toBe(1);
    h.showCurrentResults(); expect(h.progressionService.profile.lifetimeXp).toBe(profile.lifetimeXp);
    click('Next Mission Briefing'); expect(root.querySelector('.campaign-briefing h2')?.textContent).toBe('Perimeter Receipt'); expect(root.querySelectorAll('.campaign-card:disabled')).toHaveLength(8);
    expect(h.npcManager.getSnapshots()).toHaveLength(0);
  }, 20000);

  it('returns to a usable briefing with a clear error when a map load fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(h.mapManager, 'load').mockImplementationOnce(() => { throw new Error('Map test failure'); });
    click('Campaign · Carrier Zero'); click('Deploy');
    expect(h.stateMachine.state).toBe(ApplicationState.MAIN_MENU); expect(root.querySelector('.campaign-error')?.textContent).toContain('Map test failure');
    expect(root.querySelector<HTMLButtonElement>('[data-action="deploy"]')?.disabled).toBe(false);
    click('Back to Arena Setup'); expect(root.querySelector<HTMLElement>('.startup-overlay')?.hidden).toBe(false);
  });
});
