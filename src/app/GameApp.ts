import { AppLifecycle } from '../engine/AppLifecycle';
import { Diagnostics } from '../engine/Diagnostics';
import { reportError } from '../engine/ErrorReporter';
import { GameLoop, type GameLoopMetrics } from '../engine/GameLoop';
import { InputManager } from '../engine/InputManager';
import { Renderer } from '../engine/Renderer';
import { SceneManager } from '../engine/SceneManager';
import { CollisionWorld } from '../physics/CollisionWorld';
import { CombatEventBus } from '../combat/CombatEvents';
import { DamageSystem } from '../combat/DamageSystem';
import { CombatTargetRegistry } from '../combat/HitDetection';
import { createDefaultPlayerConfig, PlayerController } from '../player/PlayerController';
import {
  defaultPlayerSettings,
  PlayerSettingsStore,
  type PlayerConfig,
  type PlayerSettings,
} from '../player/PlayerConfig';
import { TargetRange } from '../targets/TargetRange';
import { WeaponController } from '../weapons/WeaponController';
import { AmmoPickupSystem } from '../weapons/AmmoPickupSystem';
import { createGameConfig, type GameConfig } from './GameConfig';
import { ApplicationState, GameStateMachine } from './GameState';
import { AppShell } from '../ui/AppShell';
import { PlayerHealth } from '../player/PlayerHealth';
import { NPCManager } from '../ai/NPCManager';
import { createMapRegistry } from '../world/MapRegistry';
import { MapManager } from '../world/MapManager';
import { MAP_DEFINITIONS } from '../world/maps/MapCatalog';
import type { MapInstance } from '../world/MapInstance';

export class GameApp {
  private readonly root: HTMLElement;
  private readonly config: GameConfig;
  private readonly stateMachine = new GameStateMachine();
  private readonly shell: AppShell;
  private readonly mapRegistry = createMapRegistry(MAP_DEFINITIONS);
  private renderer: Renderer | null = null;
  private sceneManager: SceneManager | null = null;
  private collisionWorld: CollisionWorld | null = null;
  private mapManager: MapManager | null = null;
  private player: PlayerController | null = null;
  private combatEvents: CombatEventBus | null = null;
  private damageSystem: DamageSystem | null = null;
  private playerHealth: PlayerHealth | null = null;
  private targetRegistry: CombatTargetRegistry | null = null;
  private npcManager: NPCManager | null = null;
  private targetRange: TargetRange | null = null;
  private weapons: WeaponController | null = null;
  private ammoPickups: AmmoPickupSystem | null = null;
  private input: InputManager | null = null;
  private lifecycle: AppLifecycle | null = null;
  private diagnostics: Diagnostics | null = null;
  private loop: GameLoop | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private unsubscribeState: (() => void) | null = null;
  private unsubscribeCombat: (() => void) | null = null;
  private started = false;
  private shuttingDown = false;
  private readonly playerSettingsStore = new PlayerSettingsStore();
  private readonly playerConfig: PlayerConfig;
  private readonly sensitivityMinimum: number;
  private readonly sensitivityMaximum: number;
  private playerSettings: PlayerSettings;
  private resumePending = false;
  private selectedMapId = 'neon-yard';

  public constructor(root: HTMLElement, config = createGameConfig()) {
    this.root = root;
    this.config = config;
    this.playerConfig = createDefaultPlayerConfig(config);
    this.sensitivityMinimum = this.playerConfig.look.mouseSensitivity * 0.25;
    this.sensitivityMaximum = this.playerConfig.look.mouseSensitivity * 4;
    this.playerSettings = defaultPlayerSettings(this.playerConfig);
    this.playerSettings = this.playerSettingsStore.load(this.playerSettings, this.playerConfig);
    document.title = `${config.applicationTitle} — Arena Combat`;
    this.shell = new AppShell(root, {
      onStartPractice: () => this.startPractice(),
      onResume: () => this.resume(),
      onReturnToMenu: () => this.returnToMenu(),
      onPause: () => this.pause(),
      onResetPractice: () => this.resetPractice(),
      onToggleDiagnostics: () => this.diagnostics?.toggle(),
      onMouseSensitivityChange: (value) => this.setMouseSensitivity(value),
      onFieldOfViewChange: (value) => this.setFieldOfView(value),
      onHeadBobChange: (enabled) => this.setHeadBobEnabled(enabled),
      onSelectMap: (mapId) => this.selectMap(mapId),
      showDiagnosticsControl: this.config.development,
    }, this.mapRegistry.list());
    this.shell.setState(this.stateMachine.state);
    this.shell.setSettings(this.playerSettings);
    this.shell.setMapSelection(this.selectedMapId);
  }

  public async start(): Promise<void> {
    if (this.started || this.shuttingDown) {
      return;
    }

    this.started = true;
    try {
      await this.initializeSystems();
      this.stateMachine.transitionTo(ApplicationState.MAIN_MENU);
    } catch (error) {
      this.handleInitializationError(error);
    }
  }

  public get state(): ApplicationState {
    return this.stateMachine.state;
  }

  public dispose(): void {
    if (this.shuttingDown) {
      return;
    }

    this.shuttingDown = true;
    this.loop?.dispose();
    this.lifecycle?.dispose();
    this.input?.dispose();
    this.player?.dispose();
    this.weapons?.dispose();
    this.ammoPickups?.dispose();
    this.targetRange?.dispose();
    this.npcManager?.dispose();
    this.mapManager?.dispose();
    this.unsubscribeCombat?.();
    this.combatEvents?.clear();
    this.collisionWorld?.dispose();
    this.resizeObserver?.disconnect();
    this.unsubscribeState?.();
    this.diagnostics?.dispose();
    this.sceneManager?.dispose();
    this.renderer?.dispose();
    this.loop = null;
    this.lifecycle = null;
    this.input = null;
    this.resizeObserver = null;
    this.diagnostics = null;
    this.sceneManager = null;
    this.player = null;
    this.weapons = null;
    this.ammoPickups = null;
    this.targetRange = null;
    this.targetRegistry = null;
    this.npcManager = null;
    this.playerHealth = null;
    this.damageSystem = null;
    this.combatEvents = null;
    this.collisionWorld = null;
    this.mapManager = null;
    this.renderer = null;
  }

  private async initializeSystems(): Promise<void> {
    this.renderer = new Renderer(this.shell.stage, this.config);
    this.sceneManager = new SceneManager(this.config);
    this.input = new InputManager();
    this.collisionWorld = await CollisionWorld.create([]);
    this.mapManager = new MapManager(this.sceneManager.scene, this.collisionWorld, this.mapRegistry);
    const initialMap = this.mapManager.load('neon-yard');
    this.player = new PlayerController(
      this.sceneManager.scene,
      this.sceneManager.camera,
      this.renderer.canvas,
      this.input,
      this.collisionWorld,
      {
        onPointerLockChanged: (locked) => this.handlePointerLockChanged(locked),
        onPointerLockError: (error) => this.handlePointerLockError(error),
      },
      this.playerConfig,
    );
    this.player.applySettings(this.playerSettings);
    this.combatEvents = new CombatEventBus();
    this.damageSystem = new DamageSystem(this.combatEvents);
    this.playerHealth = new PlayerHealth(this.player.getRoot());
    this.targetRegistry = new CombatTargetRegistry();
    this.npcManager = new NPCManager(
      this.sceneManager.scene,
      this.collisionWorld,
      this.playerHealth,
      this.damageSystem,
      this.targetRegistry,
      this.combatEvents,
      this.config.npcDifficulty,
    );
    this.npcManager.setMap(initialMap);
    this.targetRange = new TargetRange(this.damageSystem, this.targetRegistry, initialMap.trainingTargets);
    this.sceneManager.scene.add(this.targetRange.group);
    this.weapons = new WeaponController(
      this.sceneManager.scene,
      this.sceneManager.camera,
      this.input,
      this.collisionWorld,
      this.damageSystem,
      this.targetRegistry,
      this.combatEvents,
      {
        onRecoil: (yaw, pitch) => this.player?.addLookImpulse(yaw, pitch),
        onAimChanged: (aiming, fovMultiplier) => this.player?.setAiming(aiming, fovMultiplier),
        onHitFeedback: (result) => this.shell.showHitMarker(result.critical, result.defeated, result.damage),
        getPlayerMovement: () => ({ horizontalSpeed: this.player?.getSnapshot().horizontalSpeed ?? 0 }),
      },
    );
    this.ammoPickups = new AmmoPickupSystem(initialMap.pickups);
    this.sceneManager.scene.add(this.ammoPickups.group);
    this.unsubscribeCombat = this.combatEvents.subscribe((event) => {
      if (event.type === 'target-defeated') {
        this.shell.showCombatMessage(event.result.targetId === 'player'
          ? 'Player defeated — reset the practice encounter'
          : `${event.result.targetId} defeated`);
      } else if (event.type === 'weapon-reloaded') {
        this.shell.showCombatMessage('Reloaded');
      } else if (event.type === 'weapon-empty') {
        this.shell.showCombatMessage('Magazine empty — press R to reload');
      }
    });

    const stepSeconds = 1 / this.config.targetSimulationHz;
    this.loop = new GameLoop(
      (deltaSeconds) => this.update(deltaSeconds),
      (interpolation, metrics) => this.render(interpolation, metrics),
      {
        stepSeconds,
        maxFrameDeltaSeconds: this.config.maxFrameDeltaSeconds,
        maxSimulationStepsPerFrame: this.config.maxSimulationStepsPerFrame,
      },
    );
    this.loop.setSimulationEnabled(false);

    this.diagnostics = new Diagnostics(
      this.root,
      this.config.diagnostics.enabledByDefault,
      this.config.diagnostics.refreshIntervalMs,
      {
        getState: () => this.stateMachine.state,
        getLoopMetrics: () => this.loop?.getMetrics() ?? {
          fps: 0,
          frameTimeMs: 0,
          averageFrameTimeMs: 0,
          simulationSteps: 0,
          droppedTimeSeconds: 0,
          lastDeltaSeconds: 0,
          simulationTimeMs: 0,
          renderTimeMs: 0,
          frames: 0,
        },
        getRendererStats: () => this.renderer?.getStats() ?? {
          width: 0,
          height: 0,
          pixelRatio: 0,
          drawCalls: null,
          geometries: null,
          textures: null,
        },
        getInput: () => this.input as InputManager,
        getPlayer: () => this.player?.getSnapshot() ?? null,
        getWeapon: () => this.weapons?.getHudState() ?? null,
        getNPCs: () => this.npcManager?.getSummary() ?? null,
      },
    );

    this.unsubscribeState = this.stateMachine.subscribe((_, nextState) => {
      this.shell.setState(nextState);
      this.loop?.setSimulationEnabled(nextState === ApplicationState.PLAYING);
      this.input?.reset();
      this.player?.setActive(nextState === ApplicationState.PLAYING);
      this.weapons?.setActive(nextState === ApplicationState.PLAYING);
      this.npcManager?.setActive(nextState === ApplicationState.PLAYING);
    });

    this.lifecycle = new AppLifecycle(document, window, {
      onVisibilityChanged: (visible) => {
        this.loop?.setSuspended(!visible);
        if (!visible) {
          this.handleFocusLoss();
        }
      },
      onFocusLost: () => this.handleFocusLoss(),
    });
    this.lifecycle.start();

    this.resizeObserver = new ResizeObserver(() => this.resizeRenderer());
    this.resizeObserver.observe(this.shell.stage);
    this.resizeRenderer();
    this.loop.start();
  }

  private startPractice(): void {
    if (this.stateMachine.state === ApplicationState.MAIN_MENU) {
      if (!this.stateMachine.transitionTo(ApplicationState.LOADING_MATCH)) {
        return;
      }
      try {
        const map = this.mapManager?.load(this.selectedMapId);
        if (!map) throw new Error('Map manager is not ready.');
        this.activateMapEncounter(map);
      } catch (error) {
        const message = reportError(`Unable to load ${this.selectedMapId}`, error);
        this.stateMachine.transitionTo(ApplicationState.MAIN_MENU);
        this.shell.setMapLoadStatus(`${message} Select another map or retry.`, true);
        return;
      }
      this.input?.reset();
      this.targetRange?.reset();
      this.weapons?.reset();
      this.shell.setMapLoadStatus('Requesting mouse capture from the browser…', false);
    } else if (this.stateMachine.state !== ApplicationState.LOADING_MATCH) {
      return;
    }

    this.shell.setPointerLockStatus('Requesting mouse capture from the browser…', false);
    this.clearFocusedControl();
    void this.weapons?.resumeAudio();
    if (!this.player?.requestPointerLock()) {
      this.handlePointerLockError(new Error('Pointer lock is not available in this browser.'));
    }
  }

  private pause(): void {
    if (this.stateMachine.state === ApplicationState.PLAYING) {
      this.stateMachine.transitionTo(ApplicationState.PAUSED);
      this.player?.exitPointerLock();
      this.weapons?.setActive(false);
    }
  }

  private resume(): void {
    if (this.stateMachine.state === ApplicationState.PAUSED) {
      this.resumePending = true;
      this.shell.setResumeStatus('Requesting mouse capture…');
      this.clearFocusedControl();
      void this.weapons?.resumeAudio();
      if (!this.player?.requestPointerLock()) {
        this.resumePending = false;
        this.handlePointerLockError(new Error('Pointer lock is not available in this browser.'));
      }
    }
  }

  private returnToMenu(): void {
    if (
      this.stateMachine.state === ApplicationState.PLAYING
      || this.stateMachine.state === ApplicationState.PAUSED
      || this.stateMachine.state === ApplicationState.LOADING_MATCH
    ) {
      this.resumePending = false;
      this.stateMachine.transitionTo(ApplicationState.MAIN_MENU);
      this.player?.exitPointerLock();
      this.player?.reset();
      this.playerHealth?.reset();
      this.npcManager?.reset();
      this.targetRange?.reset();
      this.weapons?.reset();
      this.ammoPickups?.reset();
      this.npcManager?.clearMap();
      this.targetRange?.setDefinitions([]);
      this.ammoPickups?.setDefinitions([]);
      this.mapManager?.unload();
    }
  }

  private resetPractice(): void {
    if (this.stateMachine.state !== ApplicationState.PAUSED) {
      return;
    }
    this.player?.reset();
    this.playerHealth?.reset();
    this.npcManager?.reset();
    this.targetRange?.reset();
    this.weapons?.reset();
    this.ammoPickups?.reset();
    this.shell.setResumeStatus('Practice position, velocity, and camera reset.');
  }

  private selectMap(mapId: string): void {
    if (!this.mapRegistry.has(mapId) || this.stateMachine.state !== ApplicationState.MAIN_MENU) {
      return;
    }
    this.selectedMapId = mapId;
    this.shell.setMapSelection(mapId);
  }

  private activateMapEncounter(map: MapInstance): void {
    const playerSpawn = map.playerSpawns[0];
    if (!playerSpawn) {
      throw new Error(`Map ${map.definition.id} has no player spawn.`);
    }
    this.player?.reset([playerSpawn.position.x, playerSpawn.position.y, playerSpawn.position.z]);
    this.playerHealth?.reset();
    this.npcManager?.setMap(map);
    this.npcManager?.reset();
    this.targetRange?.setDefinitions(map.trainingTargets);
    this.ammoPickups?.setDefinitions(map.pickups);
    this.ammoPickups?.reset();
  }

  private update(_deltaSeconds: number): void {
    if (this.stateMachine.state !== ApplicationState.PLAYING) {
      return;
    }

    if (this.input?.consumePressed('Escape')) {
      this.pause();
      return;
    }
    this.player?.update(_deltaSeconds);
    const playerPosition = this.player?.getSnapshot().position;
    if (playerPosition) {
      this.npcManager?.update(_deltaSeconds, playerPosition);
    }
    this.targetRange?.update(_deltaSeconds);
    this.weapons?.update(_deltaSeconds, this.player?.isPointerLocked ?? false);
    if (playerPosition && this.weapons) {
      this.ammoPickups?.update(_deltaSeconds, playerPosition, this.weapons);
    }
  }

  private render(_interpolation: number, _metrics: GameLoopMetrics): void {
    if (!this.renderer || !this.sceneManager || !this.diagnostics) {
      return;
    }

    this.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    if (this.weapons) {
      this.shell.setWeaponStatus(this.weapons.getHudState());
    }
    if (this.playerHealth) {
      this.shell.setPlayerHealth(this.playerHealth.health, this.playerHealth.maxHealth);
    }
    this.diagnostics.update(typeof performance === 'undefined' ? Date.now() : performance.now());
    this.input?.endFrame();
  }

  private resizeRenderer(): void {
    if (!this.renderer || !this.sceneManager) {
      return;
    }

    const bounds = this.shell.stage.getBoundingClientRect();
    this.renderer.resize(bounds.width, bounds.height, this.sceneManager.camera);
  }

  private handleInitializationError(error: unknown): void {
    const message = reportError('Application initialization failed', error);
    this.stateMachine.transitionTo(ApplicationState.ERROR);
    this.shell.showError(message);
    // Dispose every subsystem that was created before the failure. This keeps a
    // partial startup from leaving a canvas, listeners, or a render loop alive.
    this.dispose();
  }

  private handlePointerLockChanged(locked: boolean): void {
    if (locked) {
      if (this.stateMachine.state === ApplicationState.LOADING_MATCH) {
        this.stateMachine.transitionTo(ApplicationState.PLAYING);
      } else if (this.stateMachine.state === ApplicationState.PAUSED && this.resumePending) {
        this.resumePending = false;
        this.stateMachine.transitionTo(ApplicationState.PLAYING);
      }
      return;
    }

    if (this.stateMachine.state === ApplicationState.PLAYING) {
      this.pause();
    }
  }

  private handlePointerLockError(error: Error): void {
    this.resumePending = false;
    const message = `Mouse capture failed: ${error.message}`;
    if (this.stateMachine.state === ApplicationState.LOADING_MATCH) {
      this.shell.setPointerLockStatus(`${message} Click Try Again to retry.`, true);
    } else if (this.stateMachine.state === ApplicationState.PAUSED) {
      this.shell.setResumeStatus(`${message} Gameplay remains paused.`);
    }
    if (this.config.development) {
      console.warn(`[NEON STRIKE] ${message}`);
    }
  }

  private handleFocusLoss(): void {
    this.input?.reset();
    if (this.stateMachine.state === ApplicationState.PLAYING) {
      this.pause();
    }
  }

  private setMouseSensitivity(value: number): void {
    if (!Number.isFinite(value)) {
      return;
    }
    this.playerSettings.mouseSensitivity = Math.min(Math.max(value, this.sensitivityMinimum), this.sensitivityMaximum);
    this.player?.applySettings(this.playerSettings);
    this.playerSettingsStore.save(this.playerSettings);
  }

  private setFieldOfView(value: number): void {
    if (!Number.isFinite(value)) {
      return;
    }
    this.playerSettings.fieldOfView = Math.min(
      Math.max(value, this.playerConfig.look.minimumFieldOfView),
      this.playerConfig.look.maximumFieldOfView,
    );
    this.player?.applySettings(this.playerSettings);
    this.playerSettingsStore.save(this.playerSettings);
  }

  private setHeadBobEnabled(enabled: boolean): void {
    this.playerSettings.headBobEnabled = enabled;
    this.player?.applySettings(this.playerSettings);
    this.playerSettingsStore.save(this.playerSettings);
  }

  private clearFocusedControl(): void {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  }
}
