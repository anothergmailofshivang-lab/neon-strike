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
import { CharacterRegistry } from '../characters/CharacterRegistry';
import { CHARACTER_DEFINITIONS } from '../characters/CharacterDefinitions';
import { CharacterSelection } from '../characters/CharacterCustomization';
import { CharacterPreview } from '../characters/CharacterPreview';
import { WeaponSkinRegistry } from '../cosmetics/WeaponSkinRegistry';
import { WEAPON_SKIN_DEFINITIONS } from '../cosmetics/WeaponSkinDefinitions';
import { LoadoutManager } from '../loadouts/LoadoutManager';
import { SaveManager } from '../persistence/SaveManager';
import { createWeaponCatalog } from '../weapons/WeaponDefinitions';
import { getWeaponDefinition } from '../weapons/WeaponDefinitions';
import type { PlayerLoadout } from '../loadouts/LoadoutTypes';
import { Minimap } from '../ui/Minimap';
import { listGameModes, createDefaultMatchSettings, validateMatchSettings } from '../match/GameModeDefinitions';
import type { GameModeId, TeamId } from '../match/MatchTypes';
import { MatchSession } from '../match/MatchSession';
import { ObjectiveManager } from '../match/ObjectiveManager';
import * as THREE from 'three';

export class GameApp {
  private readonly root: HTMLElement;
  private readonly config: GameConfig;
  private readonly stateMachine = new GameStateMachine();
  private readonly shell: AppShell;
  private readonly mapRegistry = createMapRegistry(MAP_DEFINITIONS);
  private readonly characterRegistry = new CharacterRegistry(CHARACTER_DEFINITIONS);
  private readonly weaponSkinRegistry = new WeaponSkinRegistry(WEAPON_SKIN_DEFINITIONS);
  private readonly loadoutManager = new LoadoutManager(createWeaponCatalog(), this.weaponSkinRegistry);
  private readonly characterSelection = new CharacterSelection(this.characterRegistry);
  private readonly saveManager = new SaveManager(this.characterRegistry, this.loadoutManager);
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
  private unsubscribeMatch: (() => void) | null = null;
  private started = false;
  private shuttingDown = false;
  private readonly playerSettingsStore = new PlayerSettingsStore();
  private readonly playerConfig: PlayerConfig;
  private readonly sensitivityMinimum: number;
  private readonly sensitivityMaximum: number;
  private playerSettings: PlayerSettings;
  private resumePending = false;
  private selectedMapId = 'modern-city';
  private characterPreview: CharacterPreview | null = null;
  private minimap: Minimap | null = null;
  private matchSession: MatchSession | null = null;
  private objectiveManager: ObjectiveManager | null = null;
  private matchSettings = createDefaultMatchSettings('practice', 'modern-city');
  private playerRespawnRemaining = 0;

  public constructor(root: HTMLElement, config = createGameConfig()) {
    this.root = root;
    this.config = config;
    this.playerConfig = createDefaultPlayerConfig(config);
    this.sensitivityMinimum = this.playerConfig.look.mouseSensitivity * 0.25;
    this.sensitivityMaximum = this.playerConfig.look.mouseSensitivity * 4;
    this.playerSettings = defaultPlayerSettings(this.playerConfig);
    this.playerSettings = this.playerSettingsStore.load(this.playerSettings, this.playerConfig);
    const savedPreferences = this.saveManager.load();
    this.characterSelection.setAppearance(savedPreferences.appearance);
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
      onSelectMode: (modeId) => this.selectMode(modeId),
      onDifficultyChange: (difficulty) => this.updateMatchSettings({ difficulty: difficulty as typeof this.matchSettings.difficulty }),
      onMatchDurationChange: (value) => this.updateMatchSettings({ durationSeconds: value }),
      onScoreLimitChange: (value) => this.updateMatchSettings({ scoreLimit: value }),
      onNpcCountChange: (value) => this.updateMatchSettings({ npcCount: value }),
      onRoundsChange: (value) => this.updateMatchSettings({ rounds: value }),
      onToggleScoreboard: () => this.shell.toggleScoreboard(),
      onRematch: () => this.rematch(),
      onResultsSetup: () => this.returnFromResultsToSetup(),
      onResultsMenu: () => this.returnFromResultsToSetup(),
      onOpenCustomization: () => this.openCustomization(),
      onCloseCustomization: () => this.closeCustomization(),
      onSelectCharacter: (id) => this.selectCharacter(id),
      onSelectPalette: (id) => this.changeAppearance(() => this.characterSelection.setPalette(id)),
      onSelectOutfit: (id) => this.changeAppearance(() => this.characterSelection.setOutfit(id)),
      onSelectHeadVariant: (id) => this.changeAppearance(() => this.characterSelection.setHeadVariant(id)),
      onSelectPrimary: (id) => this.changeLoadout(() => this.loadoutManager.setPrimaryWeapon(id)),
      onSelectSecondary: (id) => this.changeLoadout(() => this.loadoutManager.setSecondaryWeapon(id)),
      onSelectPrimarySkin: (id) => this.changeLoadout(() => this.loadoutManager.setPrimarySkin(id)),
      onSelectSecondarySkin: (id) => this.changeLoadout(() => this.loadoutManager.setSecondarySkin(id)),
      onPreviewWeapon: (weaponId, skinId) => this.previewWeapon(weaponId, skinId),
      onResetAppearance: () => this.changeAppearance(() => this.characterSelection.resetAppearance()),
      onSaveCustomization: () => this.saveCustomization(),
      showDiagnosticsControl: this.config.development,
    }, this.mapRegistry.list(), this.characterRegistry.list(), this.loadoutManager.weaponCatalog, this.weaponSkinRegistry.list(), listGameModes());
    this.shell.setState(this.stateMachine.state);
    this.shell.setSettings(this.playerSettings);
    this.shell.setMapSelection(this.selectedMapId);
    this.shell.setMatchSettings(this.matchSettings);
    this.shell.setCustomizationState(this.characterSelection.definition, this.characterSelection.appearance, this.loadoutManager.loadout);
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
    this.characterPreview?.dispose();
    this.minimap?.dispose();
    this.weapons?.dispose();
    this.ammoPickups?.dispose();
    this.targetRange?.dispose();
    this.npcManager?.dispose();
    this.mapManager?.dispose();
    this.unsubscribeCombat?.();
    this.unsubscribeMatch?.();
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
    this.characterPreview = null;
    this.minimap = null;
    this.objectiveManager?.dispose();
    this.objectiveManager = null;
    this.matchSession = null;
  }

  private async initializeSystems(): Promise<void> {
    this.renderer = new Renderer(this.shell.stage, this.config);
    this.sceneManager = new SceneManager(this.config);
    this.input = new InputManager();
    this.collisionWorld = await CollisionWorld.create([]);
    this.mapManager = new MapManager(this.sceneManager.scene, this.collisionWorld, this.mapRegistry);
    const initialMap = this.mapManager.load('modern-city');
    this.minimap = new Minimap(this.shell.minimapContainer);
    this.minimap.setMap(initialMap);
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
    this.characterPreview = new CharacterPreview();
    this.applyVisualConfiguration();
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
    this.npcManager.configureRoster({ modeId: 'practice', count: 0, respawnsEnabled: false });
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
    this.weapons.applyLoadout(this.loadoutManager.loadout, this.weaponSkinRegistry);
    this.weapons.applyCharacter(this.characterSelection.definition, this.characterSelection.appearance);
    this.ammoPickups = new AmmoPickupSystem(initialMap.pickups);
    this.sceneManager.scene.add(this.ammoPickups.group);
    this.unsubscribeCombat = this.combatEvents.subscribe((event) => {
      if (this.matchSession) {
        if (event.type === 'weapon-fired' && event.sourceId) {
          this.matchSession.recordShot(event.sourceId, event.shotCount);
        } else if (event.type === 'damage-applied') {
          this.matchSession.recordDamage(event.request.sourceId, event.request.targetId, event.result.damage);
        } else if (event.type === 'target-defeated') {
          if (this.matchSession.recordElimination(event.request.sourceId, event.result.targetId)) {
            const sourceName = event.request.sourceId ? this.matchSession.getParticipant(event.request.sourceId)?.displayName ?? event.request.sourceId : 'ENVIRONMENT';
            const targetName = this.matchSession.getParticipant(event.result.targetId)?.displayName ?? event.result.targetId;
            this.shell.addKillFeedMessage(`${sourceName} eliminated ${targetName}`);
            if (event.result.targetId === 'player' && this.matchSettings.respawnsEnabled) this.playerRespawnRemaining = 3;
            if (event.result.targetId === 'player') this.collisionWorld?.setActorEnabled('player', false);
          }
        }
      }
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
      this.characterPreview?.setVisible(false);
      this.minimap?.setVisible(nextState === ApplicationState.PLAYING);
      this.objectiveManager?.group && (this.objectiveManager.group.visible = nextState === ApplicationState.PLAYING);
      this.syncMatchSimulationActivity();
      if (nextState === ApplicationState.MATCH_RESULTS && this.matchSession) this.shell.showResults(this.matchSession.snapshot());
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
        this.matchSettings = validateMatchSettings({ ...this.matchSettings, mapId: this.selectedMapId }, this.mapRegistry.list().map((definition) => definition.id));
        const map = this.mapManager?.load(this.matchSettings.mapId);
        if (!map) throw new Error('Map manager is not ready.');
        this.matchSession = new MatchSession(this.matchSettings);
        this.damageSystem?.setPolicy((sourceId, targetId) => {
          const source = this.matchSession?.getParticipant(sourceId);
          const target = this.matchSession?.getParticipant(targetId);
          return !source || !target || source.teamId !== target.teamId;
        });
        this.matchSession.addParticipant({ id: 'player', displayName: 'PLAYER', teamId: 'player', kind: 'player' });
        this.objectiveManager = new ObjectiveManager(this.matchSession);
        this.objectiveManager.setMap(map);
        this.npcManager?.setObjectiveDestinations(this.objectiveManager.getMinimapStates().map((objective) => objective.position));
        this.sceneManager?.scene.add(this.objectiveManager.group);
        this.npcManager?.setDifficulty(this.matchSettings.difficulty);
        this.npcManager?.configureRoster({ modeId: this.matchSettings.modeId, count: this.matchSettings.npcCount, respawnsEnabled: this.matchSettings.respawnsEnabled });
        this.activateMapEncounter(map);
        for (const npc of this.npcManager?.getSnapshots() ?? []) {
          this.matchSession.addParticipant({ id: npc.id, displayName: npc.archetype.toUpperCase(), teamId: npc.teamId as TeamId, kind: 'npc', archetype: npc.archetype });
        }
        this.unsubscribeMatch = this.matchSession.subscribe((event) => this.handleMatchEvent(event));
        this.matchSession.start();
      } catch (error) {
        const message = reportError(`Unable to load ${this.selectedMapId}`, error);
        this.stateMachine.transitionTo(ApplicationState.MAIN_MENU);
        this.shell.setMapLoadStatus(`${message} Select another map or retry.`, true);
        this.clearMatchRuntime();
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
      this.matchSession?.setPaused(true);
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
      || this.stateMachine.state === ApplicationState.MATCH_RESULTS
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
      this.minimap?.setMap(null);
      this.clearMatchRuntime();
    }
  }

  private rematch(): void {
    if (this.stateMachine.state !== ApplicationState.MATCH_RESULTS) return;
    this.returnFromResultsToSetup(true);
  }

  private returnFromResultsToSetup(startImmediately = false): void {
    if (this.stateMachine.state !== ApplicationState.MATCH_RESULTS) return;
    this.clearMatchRuntime();
    if (this.stateMachine.transitionTo(ApplicationState.MAIN_MENU) && startImmediately) this.startPractice();
  }

  private resetPractice(): void {
    if (this.stateMachine.state !== ApplicationState.PAUSED) {
      return;
    }
    const playerSpawn = this.mapManager?.current?.playerSpawns[0];
    this.player?.reset(playerSpawn ? [playerSpawn.position.x, playerSpawn.position.y, playerSpawn.position.z] : undefined, playerSpawn?.yaw ?? 0);
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
    this.matchSettings = { ...this.matchSettings, mapId };
    this.shell.setMapSelection(mapId);
  }

  private selectMode(modeId: GameModeId): void {
    if (this.stateMachine.state !== ApplicationState.MAIN_MENU) return;
    this.matchSettings = { ...createDefaultMatchSettings(modeId, this.selectedMapId), difficulty: this.matchSettings.difficulty };
    this.shell.setMatchSettings(this.matchSettings);
  }

  private updateMatchSettings(changes: Partial<typeof this.matchSettings>): void {
    if (this.stateMachine.state !== ApplicationState.MAIN_MENU) return;
    this.matchSettings = validateMatchSettings({ ...this.matchSettings, ...changes }, this.mapRegistry.list().map((definition) => definition.id));
    this.shell.setMatchSettings(this.matchSettings);
  }

  private openCustomization(): void {
    if (this.stateMachine.state !== ApplicationState.MAIN_MENU) return;
    this.characterPreview?.showCharacter(this.characterSelection.definition, this.characterSelection.appearance);
    this.characterPreview?.setVisible(true);
    this.shell.setCustomizationVisible(true);
  }

  private closeCustomization(): void {
    this.characterPreview?.setVisible(false);
    this.shell.setCustomizationVisible(false);
  }

  private selectCharacter(id: string): void {
    try {
      this.characterSelection.selectCharacter(id);
      this.applyVisualConfiguration();
      this.shell.setCustomizationStatus(`${this.characterSelection.definition.displayName} selected.`);
    } catch (error) {
      this.shell.setCustomizationStatus(error instanceof Error ? error.message : String(error));
    }
  }

  private changeAppearance(change: () => unknown): void {
    try {
      change();
      this.applyVisualConfiguration();
      this.shell.setCustomizationStatus('Appearance updated. Save configuration to persist it.');
    } catch (error) {
      this.shell.setCustomizationStatus(error instanceof Error ? error.message : String(error));
    }
  }

  private changeLoadout(change: () => PlayerLoadout): void {
    try {
      change();
      if (this.stateMachine.state === ApplicationState.MAIN_MENU) this.weapons?.applyLoadout(this.loadoutManager.loadout, this.weaponSkinRegistry);
      this.shell.setCustomizationStatus('Loadout updated. Save configuration to persist it.');
      this.shell.setCustomizationState(this.characterSelection.definition, this.characterSelection.appearance, this.loadoutManager.loadout);
    } catch (error) {
      this.shell.setCustomizationStatus(error instanceof Error ? error.message : String(error));
    }
  }

  private saveCustomization(): void {
    const saved = this.saveManager.save({ characterId: this.characterSelection.selectedCharacterId, appearance: this.characterSelection.appearance, loadout: this.loadoutManager.loadout });
    this.shell.setCustomizationStatus(saved ? 'Configuration saved locally.' : 'Configuration active for this session; browser storage was unavailable.');
  }

  private previewWeapon(weaponId: string, skinId: string): void {
    try {
      this.characterPreview?.showWeapon(getWeaponDefinition(weaponId), this.weaponSkinRegistry.get(skinId));
      this.characterPreview?.setVisible(true);
      this.shell.setCustomizationStatus('Weapon preview updated. Select an operative to return to the character preview.');
    } catch (error) {
      this.shell.setCustomizationStatus(error instanceof Error ? error.message : String(error));
    }
  }

  private applyVisualConfiguration(): void {
    this.characterPreview?.showCharacter(this.characterSelection.definition, this.characterSelection.appearance);
    this.weapons?.applyCharacter(this.characterSelection.definition, this.characterSelection.appearance);
    this.shell.setCustomizationState(this.characterSelection.definition, this.characterSelection.appearance, this.loadoutManager.loadout);
  }

  private activateMapEncounter(map: MapInstance): void {
    const playerSpawn = map.playerSpawns[0];
    if (!playerSpawn) {
      throw new Error(`Map ${map.definition.id} has no player spawn.`);
    }
    this.player?.reset([playerSpawn.position.x, playerSpawn.position.y, playerSpawn.position.z], playerSpawn.yaw);
    this.playerRespawnRemaining = 0;
    this.playerHealth?.reset();
    this.npcManager?.setMap(map);
    this.npcManager?.reset();
    this.weapons?.applyLoadout(this.loadoutManager.loadout, this.weaponSkinRegistry);
    this.applyVisualConfiguration();
    this.targetRange?.setDefinitions(this.matchSettings.modeId === 'practice' ? map.trainingTargets : []);
    this.ammoPickups?.setDefinitions(map.pickups);
    this.ammoPickups?.reset();
    this.minimap?.setMap(map);
  }

  private update(_deltaSeconds: number): void {
    if (this.stateMachine.state !== ApplicationState.PLAYING) {
      return;
    }

    if (this.input?.consumePressed('Escape')) {
      this.pause();
      return;
    }
    this.matchSession?.update(_deltaSeconds);
    if (this.matchSession?.phase === 'active' && this.playerHealth?.isDefeated && this.matchSettings.respawnsEnabled) {
      this.playerRespawnRemaining = Math.max(this.playerRespawnRemaining - Math.min(Math.max(_deltaSeconds, 0), 0.25), 0);
      if (this.playerRespawnRemaining === 0) {
        const spawn = this.mapManager?.current?.playerSpawns[0];
        this.player?.reset(spawn ? [spawn.position.x, spawn.position.y, spawn.position.z] : undefined, spawn?.yaw ?? 0);
        this.playerHealth.reset();
        this.collisionWorld?.setActorEnabled('player', true);
        this.matchSession.respawnParticipant('player');
        this.weapons?.reset();
      }
    }
    if (this.matchSession?.phase === 'intermission' && this.matchSession.intermissionSecondsRemaining <= 0) {
      this.npcManager?.reset();
      this.matchSession.resetRoundParticipants();
      this.matchSession.startNextRound();
    }
    this.syncMatchSimulationActivity();
    this.shell.setMatchSnapshot(this.matchSession?.snapshot() ?? createDefaultMatchSnapshot());
    if (this.matchSession?.phase !== 'active') return;
    this.player?.update(_deltaSeconds);
    const playerSnapshot = this.player?.getSnapshot();
    const playerPosition = playerSnapshot?.position;
    if (playerPosition) {
      this.npcManager?.update(_deltaSeconds, playerPosition);
      for (const npc of this.npcManager?.getSnapshots() ?? []) {
        if (npc.health > 0) this.matchSession?.respawnParticipant(npc.id);
      }
      this.objectiveManager?.update(_deltaSeconds, [
        { id: 'player', teamId: 'player', alive: !this.playerHealth?.isDefeated, position: playerPosition },
        ...(this.npcManager?.getParticipantPositions() ?? []).map((participant) => ({ ...participant, teamId: participant.teamId as 'player' | 'enemy' })),
      ]);
      this.minimap?.update(playerPosition, playerSnapshot?.yaw ?? 0, this.getMinimapNPCs(playerPosition, playerSnapshot?.yaw ?? 0), this.objectiveManager?.getMinimapStates() ?? []);
    }
    this.targetRange?.update(_deltaSeconds);
    this.weapons?.update(_deltaSeconds, this.player?.isPointerLocked ?? false);
    if (playerPosition && this.weapons) {
      this.ammoPickups?.update(_deltaSeconds, playerPosition, this.weapons);
    }
    this.characterPreview?.update(_deltaSeconds);
  }

  private render(_interpolation: number, _metrics: GameLoopMetrics): void {
    if (!this.renderer || !this.sceneManager || !this.diagnostics) {
      return;
    }

    this.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    if (this.characterPreview?.isVisible) {
      const bounds = this.shell.customizationPreviewMount.getBoundingClientRect();
      this.characterPreview.resize(bounds.width / Math.max(bounds.height, 1));
      this.renderer.renderPreview(this.characterPreview.scene, this.characterPreview.camera, bounds);
    }
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
        this.matchSession?.setPaused(false);
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

  private syncMatchSimulationActivity(): void {
    const active = this.stateMachine.state === ApplicationState.PLAYING && this.matchSession?.phase === 'active';
    const playerActive = Boolean(active) && !Boolean(this.playerHealth?.isDefeated);
    this.player?.setActive(playerActive);
    this.weapons?.setActive(playerActive);
    this.npcManager?.setActive(Boolean(active));
  }

  private getMinimapNPCs(playerPosition: THREE.Vector3, playerYaw: number): readonly import('../ai/NPCController').NPCDebugSnapshot[] {
    const snapshots = this.npcManager?.getSnapshots() ?? [];
    const forward = new THREE.Vector3(-Math.sin(playerYaw), 0, -Math.cos(playerYaw));
    return snapshots.map((snapshot) => {
      if (snapshot.teamId === 'player') return { ...snapshot, visible: snapshot.health > 0 };
      const direction = snapshot.position.clone().sub(playerPosition).setY(0);
      const distance = direction.length();
      const inView = distance <= 42 && distance > 0.1 && forward.dot(direction.normalize()) >= Math.cos(Math.PI * 0.62);
      const rayDirection = snapshot.position.clone().add(new THREE.Vector3(0, 1.1, 0)).sub(playerPosition.clone().add(new THREE.Vector3(0, 1.35, 0))).normalize();
      const obstruction = inView ? this.collisionWorld?.raycastStaticWorld(
        { x: playerPosition.x, y: playerPosition.y + 1.35, z: playerPosition.z },
        { x: rayDirection.x, y: rayDirection.y, z: rayDirection.z },
        distance,
      ) : null;
      return { ...snapshot, visible: snapshot.health > 0 && inView && obstruction === null };
    });
  }

  private handleMatchEvent(event: import('../match/MatchTypes').MatchEvent): void {
    if (event.type === 'match-completed') {
      this.syncMatchSimulationActivity();
      this.player?.exitPointerLock();
      this.stateMachine.transitionTo(ApplicationState.MATCH_RESULTS);
    } else if (event.type === 'score-changed') {
      this.shell.showCombatMessage(`${event.teamId.toUpperCase()} +${event.amount} ${event.reason}`);
    } else if (event.type === 'objective-changed') {
      this.shell.setObjectiveStates(this.matchSession?.snapshot().objectives ?? []);
    }
  }

  private clearMatchRuntime(): void {
    this.unsubscribeMatch?.();
    this.unsubscribeMatch = null;
    this.objectiveManager?.dispose();
    this.objectiveManager = null;
    this.matchSession = null;
    this.damageSystem?.setPolicy(null);
    this.playerRespawnRemaining = 0;
    this.npcManager?.configureRoster({ modeId: 'practice', count: 0, respawnsEnabled: false });
    this.npcManager?.clearMap();
    this.targetRange?.setDefinitions([]);
    this.ammoPickups?.setDefinitions([]);
  }
}

function createDefaultMatchSnapshot(): import('../match/MatchTypes').MatchSnapshot {
  const settings = createDefaultMatchSettings('practice', 'modern-city');
  return {
    sessionId: 'none', settings, phase: 'preparing', elapsedSeconds: 0, remainingSeconds: null, countdownRemaining: 0, round: 1, roundCount: 1,
    teamScores: {}, participants: [], objectives: [], outcome: null, winnerTeamId: null, resolutionReason: null,
  };
}
