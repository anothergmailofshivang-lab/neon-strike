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
import { ProgressionSaveManager } from '../persistence/ProgressionSaveManager';
import { ProfileService } from '../progression/ProfileService';
import { ProgressionService } from '../progression/ProgressionService';
import type { ProgressionRewardSummary } from '../progression/ProgressionTypes';
import { MatchCombatTracker } from '../progression/MatchCombatTracker';
import { rewardIdForWeaponSkin, getRewardDefinition } from '../progression/RewardCatalog';
import { createWeaponCatalog } from '../weapons/WeaponDefinitions';
import { getWeaponDefinition } from '../weapons/WeaponDefinitions';
import type { PlayerLoadout } from '../loadouts/LoadoutTypes';
import { Minimap } from '../ui/Minimap';
import { listGameModes, createDefaultMatchSettings, validateMatchSettings } from '../match/GameModeDefinitions';
import type { GameModeId, TeamId } from '../match/MatchTypes';
import { MatchSession } from '../match/MatchSession';
import { ObjectiveManager } from '../match/ObjectiveManager';
import { listEquipmentDefinitions } from '../equipment/EquipmentCatalog';
import { TacticalEquipmentService } from '../tactical/TacticalEquipmentService';
import { InteractionManager } from '../tactical/InteractionManager';
import { DestructibleManager } from '../tactical/DestructibleManager';
import { MISSIONS, getMission } from '../campaign/CampaignCatalog';
import { validateMissionCatalog } from '../campaign/MissionValidation';
import { isMissionUnlocked, recommendedMission } from '../campaign/CampaignProgress';
import { MissionSession } from '../campaign/MissionSession';
import { MissionRuntime } from '../campaign/MissionRuntime';
import { resolveMissionWorld } from '../campaign/MissionWorld';
import type { CampaignDifficulty, MissionCheckpoint, MissionDefinition, MissionEvent, MissionStatistics } from '../campaign/CampaignTypes';
import type { MatchProgressionStats } from '../progression/ProgressionTypes';
import * as THREE from 'three';
import { SettingsService, defaultGameSettings, bindingLabel, type GameSettings } from '../settings/SettingsService';
import { TutorialRuntime, type TutorialSignals } from '../tutorial/TutorialRuntime';

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
  private readonly progressionSaveManager = new ProgressionSaveManager();
  private readonly profileService = new ProfileService(
    this.progressionSaveManager.load(this.loadoutManager.loadout),
    this.loadoutManager.loadout,
    (profile) => this.progressionSaveManager.save(profile),
  );
  private readonly progressionService = new ProgressionService(this.profileService, createWeaponCatalog());
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
  private tacticalEquipment: TacticalEquipmentService | null = null;
  private interactions: InteractionManager | null = null;
  private destructibles: DestructibleManager | null = null;
  private input: InputManager | null = null;
  private lifecycle: AppLifecycle | null = null;
  private diagnostics: Diagnostics | null = null;
  private loop: GameLoop | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private unsubscribeState: (() => void) | null = null;
  private unsubscribeCombat: (() => void) | null = null;
  private unsubscribeTactical: (() => void) | null = null;
  private unsubscribeMatch: (() => void) | null = null;
  private started = false;
  private shuttingDown = false;
  private readonly settingsService = new SettingsService();
  private readonly playerConfig: PlayerConfig;
  private readonly sensitivityMinimum: number;
  private readonly sensitivityMaximum: number;
  private unsubscribeSettings: (() => void) | null = null;
  private resumePending = false;
  private selectedMapId = 'modern-city';
  private characterPreview: CharacterPreview | null = null;
  private minimap: Minimap | null = null;
  private matchSession: MatchSession | null = null;
  private objectiveManager: ObjectiveManager | null = null;
  private matchSettings = createDefaultMatchSettings('practice', 'modern-city');
  private playerRespawnRemaining = 0;
  private combatTracker: MatchCombatTracker | null = null;
  private lastProgressionSummary: ProgressionRewardSummary | null = null;
  private mission: MissionSession | null = null;
  private missionRuntime: MissionRuntime | null = null;
  private unsubscribeMission: (() => void) | null = null;
  private checkpointCombat: MatchProgressionStats | null = null;
  private arenaSettings: typeof this.matchSettings | null = null;
  private campaignCustomization = false;
  private pendingMission: { definition: MissionDefinition; difficulty: CampaignDifficulty; restore?: { checkpoint: MissionCheckpoint; carry: MissionStatistics; combat: MatchProgressionStats } } | null = null;
  private tutorial: TutorialRuntime | null = null;
  private tutorialMap = false;
  private tutorialHit = false;
  private tutorialReloaded = false;
  private tutorialSwitched = false;
  private tutorialEquipment = false;
  private tutorialInteracted = false;
  private tutorialSaved = false;

  public constructor(root: HTMLElement, config = createGameConfig()) {
    this.root = root;
    this.config = config;
    this.playerConfig = createDefaultPlayerConfig(config);
    this.sensitivityMinimum = this.playerConfig.look.mouseSensitivity * 0.25;
    this.sensitivityMaximum = this.playerConfig.look.mouseSensitivity * 4;
    const playerDefaults = defaultPlayerSettings(this.playerConfig);
    this.settingsService.load(defaultGameSettings(
      playerDefaults.mouseSensitivity,
      playerDefaults.fieldOfView,
      playerDefaults.headBobEnabled,
      playerDefaults.cameraEffectsEnabled,
    ), {
      sensitivityMinimum: this.sensitivityMinimum,
      sensitivityMaximum: this.sensitivityMaximum,
      fieldOfViewMinimum: this.playerConfig.look.minimumFieldOfView,
      fieldOfViewMaximum: this.playerConfig.look.maximumFieldOfView,
    });
    this.matchSettings.difficulty = this.settingsService.current.defaultDifficulty;
    const savedPreferences = this.saveManager.load();
    this.profileService.update((profile) => {
      for (const skinId of [savedPreferences.loadout.primarySkinId, savedPreferences.loadout.secondarySkinId]) {
        const rewardId = rewardIdForWeaponSkin(skinId);
        if (getRewardDefinition(rewardId) && !profile.entitlements.includes(rewardId)) profile.entitlements.push(rewardId);
      }
    });
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
      settingsService: this.settingsService,
      onTestSound: async () => this.weapons?.playTestSound() ?? false,
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
       onSelectTacticalEquipment: (id) => this.changeLoadout(() => this.loadoutManager.setTacticalEquipment(id)),
       onSelectUtilityEquipment: (id) => this.changeLoadout(() => this.loadoutManager.setUtilityEquipment(id)),
       onSelectPrimarySkin: (id) => this.changeSkin('primary', id),
       onSelectSecondarySkin: (id) => this.changeSkin('secondary', id),
      onPreviewWeapon: (weaponId, skinId) => this.previewWeapon(weaponId, skinId),
       onResetAppearance: () => this.changeAppearance(() => this.characterSelection.resetAppearance()),
       onSaveCustomization: () => this.saveCustomization(),
       onOpenProgression: (section) => this.openProgression(section),
       onOpenCampaign: () => this.openCampaign(),
       onOpenTutorial: () => this.startTutorial(),
       onCompleteOnboarding: (skipped) => this.completeOnboarding(skipped),
       onTutorialExit: () => this.returnToMenu(),
       onCloseCampaign: () => this.shell.setCampaignVisible(false),
       onDeployMission: (id, difficulty) => this.deployMission(id, difficulty),
       onCampaignCustomize: () => { this.campaignCustomization = true; this.shell.setCampaignVisible(false); this.openCustomization(); },
       onRetryMission: (checkpoint) => this.retryMission(checkpoint),
       onCampaignReturn: () => { this.returnToMenu(); this.openCampaign(); },
       onNextMission: () => { this.returnToMenu(); this.openCampaign(); },
       onCloseProgression: () => this.shell.setProgressionVisible(false),
       onEquipReward: (rewardId) => this.equipReward(rewardId),
       onEquipWeaponSkin: (rewardId, slot) => this.equipWeaponSkin(rewardId, slot),
       showDiagnosticsControl: this.config.development,
     }, this.mapRegistry.list(), this.characterRegistry.list(), this.loadoutManager.weaponCatalog, this.weaponSkinRegistry.list(), listGameModes(), listEquipmentDefinitions());
    this.shell.setState(this.stateMachine.state);
    this.unsubscribeSettings = this.settingsService.subscribe((settings) => this.applySettings(settings));
    this.applySettings(this.settingsService.current);
    this.shell.setMapSelection(this.selectedMapId);
    this.shell.setMatchSettings(this.matchSettings);
    this.shell.setCustomizationState(this.characterSelection.definition, this.characterSelection.appearance, this.loadoutManager.loadout);
    this.progressionService.initialize();
    this.shell.setProgressionProfile(this.progressionService.profile);
  }

  public async start(): Promise<void> {
    if (this.started || this.shuttingDown) {
      return;
    }

    this.started = true;
    try {
      await this.initializeSystems();
    this.stateMachine.transitionTo(ApplicationState.MAIN_MENU);
      if (import.meta.env.MODE !== 'test' && !this.settingsService.current.onboardingCompleted && this.settingsService.current.onboardingStatus === 'new') this.shell.showOnboarding();
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
    this.shell.dispose();
    this.loop?.dispose();
    this.lifecycle?.dispose();
    this.input?.dispose();
    this.player?.dispose();
    this.characterPreview?.dispose();
    this.minimap?.dispose();
    this.weapons?.dispose();
    this.unsubscribeMission?.();
    this.missionRuntime?.dispose();
    this.mission?.dispose();
    this.tacticalEquipment?.dispose();
    this.interactions?.dispose();
    this.destructibles?.dispose();
    this.ammoPickups?.dispose();
    this.targetRange?.dispose();
    this.npcManager?.dispose();
    this.mapManager?.dispose();
    this.unsubscribeCombat?.();
    this.unsubscribeTactical?.();
    this.unsubscribeMatch?.();
    this.combatEvents?.clear();
    this.collisionWorld?.dispose();
    this.resizeObserver?.disconnect();
    this.unsubscribeState?.();
    this.unsubscribeSettings?.();
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
    this.tacticalEquipment = null;
    this.interactions = null;
    this.destructibles = null;
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
    this.renderer = new Renderer(this.shell.stage, this.config, { onContextLost: () => this.handleRendererContextLost() });
    this.sceneManager = new SceneManager(this.config);
    this.input = new InputManager();
    this.input.setEnabled(false);
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
    this.player.applySettings(this.settingsService.current);
    this.characterPreview = new CharacterPreview();
    this.applyVisualConfiguration();
    this.combatEvents = new CombatEventBus();
    this.damageSystem = new DamageSystem(this.combatEvents);
    this.playerHealth = new PlayerHealth(this.player.getRoot());
    this.targetRegistry = new CombatTargetRegistry();
    this.tacticalEquipment = new TacticalEquipmentService(this.sceneManager.scene, this.collisionWorld, this.damageSystem, this.playerHealth, null,
      () => this.stateMachine.state === ApplicationState.PLAYING && this.matchSession?.phase === 'active',
      () => this.sceneManager?.camera.getWorldDirection(new THREE.Vector3()) ?? new THREE.Vector3(0, 0, -1));
    this.interactions = new InteractionManager(this.sceneManager.scene, this.collisionWorld,
      () => this.stateMachine.state === ApplicationState.PLAYING && this.matchSession?.phase === 'active',
      () => this.weapons?.playTacticalCue('switch'),
      () => !this.playerHealth?.isDefeated);
    this.destructibles = new DestructibleManager(this.collisionWorld, this.damageSystem, this.targetRegistry);
    this.interactions.setDefinitions(initialMap.interactions ?? [], initialMap.definition.doors ?? []);
    this.destructibles.setDefinitions(initialMap.destructibles ?? []);
    this.sceneManager.scene.add(this.destructibles.group);
    this.npcManager = new NPCManager(
      this.sceneManager.scene,
      this.collisionWorld,
      this.playerHealth,
      this.damageSystem,
      this.targetRegistry,
      this.combatEvents,
      this.config.npcDifficulty,
      (origin, target) => this.tacticalEquipment?.visibility.blocksLineOfSight(origin, target) ?? false,
      this.tacticalEquipment,
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
    this.tacticalEquipment.setWeaponController(this.weapons);
    this.weapons.applyLoadout(this.loadoutManager.loadout, this.weaponSkinRegistry);
    this.tacticalEquipment.applyLoadout(this.loadoutManager.loadout);
    this.unsubscribeTactical = this.tacticalEquipment.events.subscribe((event) => {
      this.combatTracker?.event(event);
      if (event.type === 'pickup-collected') this.shell.showCombatMessage(`COLLECTED ${event.pickupType.toUpperCase()} +${event.amount}`);
      else if (event.type === 'equipment-effect' && event.effect !== 'damage') this.shell.showCombatMessage(`${event.effect.toUpperCase()} ${Math.round(event.amount)}`);
    });
    this.weapons.applyCharacter(this.characterSelection.definition, this.characterSelection.appearance);
    this.applySettings(this.settingsService.current);
    this.ammoPickups = new AmmoPickupSystem(initialMap.pickups, this.tacticalEquipment.events, this.collisionWorld,
      () => this.stateMachine.state === ApplicationState.PLAYING && this.matchSession?.phase === 'active');
    this.sceneManager.scene.add(this.ammoPickups.group);
    this.unsubscribeCombat = this.combatEvents.subscribe((event) => {
      if (this.tutorial) {
        if (event.type === 'damage-applied' && event.request.sourceId === 'player' && event.result.applied && event.request.targetId !== 'player') this.tutorialHit = true;
        if (event.type === 'weapon-reloaded') this.tutorialReloaded = true;
        if (event.type === 'weapon-switch-complete') this.tutorialSwitched = true;
      }
      if (event.type === 'damage-applied' && event.result.applied && event.request.targetId === 'player') this.tacticalEquipment?.cancelUse();
      if (event.type === 'target-defeated' && event.result.applied) this.tacticalEquipment?.actorDefeated(event.result.targetId);
      const eliminated = this.combatTracker?.combat(event);
      if (this.matchSession && event.type === 'target-defeated' && eliminated) {
        const sourceName = event.request.sourceId ? this.matchSession.getParticipant(event.request.sourceId)?.displayName ?? event.request.sourceId : 'ENVIRONMENT';
        const targetName = this.matchSession.getParticipant(event.result.targetId)?.displayName ?? event.result.targetId;
        this.shell.addKillFeedMessage(`${sourceName} eliminated ${targetName}`);
        if (event.result.targetId === 'player' && this.matchSettings.respawnsEnabled) this.playerRespawnRemaining = 3;
        if (event.result.targetId === 'player') this.collisionWorld?.setActorEnabled('player', false);
      }
      if (event.type === 'target-defeated') {
        if (this.mapManager?.current?.destructibles?.some((definition) => definition.id === event.result.targetId)) this.tacticalEquipment?.breakEffect(event.result.impactPoint);
        this.shell.showCombatMessage(event.result.targetId === 'player'
          ? 'Player eliminated'
          : `${event.result.targetId} defeated`);
      } else if (event.type === 'weapon-reloaded') {
        this.shell.showCombatMessage('Reloaded');
      } else if (event.type === 'weapon-empty') {
        this.shell.showCombatMessage(`Magazine empty — ${bindingLabel(this.settingsService.current.keyBindings.reload)} to reload`);
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
      if (nextState !== ApplicationState.PLAYING) this.shell.setInteractionPrompt('');
      this.loop?.setSimulationEnabled(nextState === ApplicationState.PLAYING);
      this.input?.reset();
      this.input?.setEnabled(nextState === ApplicationState.PLAYING);
      this.player?.setActive(nextState === ApplicationState.PLAYING);
      this.weapons?.setActive(nextState === ApplicationState.PLAYING);
      this.npcManager?.setActive(nextState === ApplicationState.PLAYING);
      this.characterPreview?.setVisible(false);
      this.minimap?.setVisible(nextState === ApplicationState.PLAYING);
      this.objectiveManager?.group && (this.objectiveManager.group.visible = nextState === ApplicationState.PLAYING);
      this.syncMatchSimulationActivity();
       if (nextState === ApplicationState.MATCH_RESULTS && this.matchSession) this.showCurrentResults();
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
        const deployment = this.pendingMission;
        if (deployment && !isMissionUnlocked(this.progressionService.profile.campaign, deployment.definition)) throw new Error('Complete the preceding operation to unlock this mission.');
        this.matchSettings = deployment
          ? { ...createDefaultMatchSettings('survival', deployment.definition.mapId), difficulty: deployment.difficulty, rounds: 1, npcCount: deployment.definition.encounters.reduce((n, e) => n + e.units.length, 0) }
          : validateMatchSettings({ ...this.matchSettings, mapId: this.selectedMapId }, this.mapRegistry.list().map((definition) => definition.id));
        this.tacticalEquipment?.resetMatch();
        this.destructibles?.clear();
        this.interactions?.clear();
        const map = this.mapManager?.load(this.matchSettings.mapId);
        if (!map) throw new Error('Map manager is not ready.');
        this.mission = deployment ? new MissionSession(deployment.definition, deployment.difficulty, deployment.restore?.checkpoint.sessionId, deployment.restore) : null;
        this.matchSession = new MatchSession(this.matchSettings, this.mission?.sessionId, Boolean(this.mission));
        this.combatTracker = new MatchCombatTracker(this.matchSession, new Set(map.destructibles?.map((definition) => definition.id) ?? []));
        this.lastProgressionSummary = null;
        this.damageSystem?.setPolicy((sourceId, targetId) => {
          const source = this.matchSession?.getParticipant(sourceId);
          const target = this.matchSession?.getParticipant(targetId);
          if (this.matchSession?.phase !== 'active' || this.stateMachine.state !== ApplicationState.PLAYING) return false;
          if (this.mission && !source) return false;
          return !source || !target || sourceId === targetId || source.teamId !== target.teamId;
        });
        this.matchSession.addParticipant({ id: 'player', displayName: 'PLAYER', teamId: 'player', kind: 'player' });
        this.objectiveManager = new ObjectiveManager(this.matchSession);
        this.objectiveManager.setMap(map);
        this.npcManager?.setObjectiveDestinations(this.objectiveManager.getMinimapStates().map((objective) => objective.position));
        this.sceneManager?.scene.add(this.objectiveManager.group);
        this.npcManager?.setDifficulty(this.matchSettings.difficulty);
        this.npcManager?.configureRoster({ modeId: this.matchSettings.modeId, count: this.mission ? 0 : this.matchSettings.npcCount, respawnsEnabled: this.matchSettings.respawnsEnabled });
        this.activateMapEncounter(map);
        this.collisionWorld?.setActorEnabled('player', true);
        if (this.mission && deployment && this.collisionWorld && this.npcManager && this.interactions && this.combatEvents && this.sceneManager) {
          const layout = resolveMissionWorld(deployment.definition, map, this.collisionWorld);
          map.navigationGraph = layout.graph;
          const spawn = deployment.restore ? layout.points.get(`checkpoint:${deployment.restore.checkpoint.checkpointId}`)! : layout.spawn;
          this.player?.reset([spawn.x, spawn.y, spawn.z], layout.yaw);
          if (deployment.restore) {
            this.matchSession.restorePlayerStatistics(deployment.restore.combat.snapshot);
            this.combatTracker.restore(deployment.restore.combat);
            this.checkpointCombat = structuredClone(deployment.restore.combat);
          }
          this.unsubscribeMission = this.mission.subscribe((event) => this.handleMissionEvent(event));
          this.missionRuntime = new MissionRuntime(this.mission, map, layout, this.npcManager, this.matchSession, this.interactions, this.combatEvents, this.sceneManager.scene);
          this.mission.prepare();
        }
        this.shell.setMissionMode(Boolean(this.mission));
        for (const npc of this.npcManager?.getSnapshots() ?? []) {
          this.matchSession.addParticipant({ id: npc.id, displayName: npc.archetype.toUpperCase(), teamId: npc.teamId as TeamId, kind: 'npc', archetype: npc.archetype });
        }
        this.unsubscribeMatch = this.matchSession.subscribe((event) => this.handleMatchEvent(event));
         this.matchSession.start();
      if (this.tutorialMap) {
           this.tutorial = new TutorialRuntime(this.player!.getSnapshot());
           this.shell.setTutorial(this.tutorial.step, this.tutorial.progress);
         }
      } catch (error) {
        const campaignLaunch = Boolean(this.pendingMission);
        const message = reportError(`Unable to load ${this.pendingMission?.definition.name ?? this.selectedMapId}`, error);
        this.stateMachine.transitionTo(ApplicationState.MAIN_MENU);
        this.shell.setMapLoadStatus(`${message} Select another map or retry.`, true);
        this.clearMatchRuntime();
        if (campaignLaunch) this.openCampaign(message);
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
      this.mission?.pause(true);
      this.tacticalEquipment?.cancelUse();
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

  private returnToMenu(preserveRun = false): void {
    if (
      this.stateMachine.state === ApplicationState.PLAYING
      || this.stateMachine.state === ApplicationState.PAUSED
      || this.stateMachine.state === ApplicationState.LOADING_MATCH
      || this.stateMachine.state === ApplicationState.MATCH_RESULTS
    ) {
      if (this.mission && !preserveRun) {
        if (['active', 'paused', 'countdown'].includes(this.mission.phase) && !window.confirm('Abort this operation? Completion rewards are not earned and the in-session checkpoint will be discarded.')) return;
        this.mission.abort();
        if (this.mission.result && this.mission.result.outcome !== 'success') this.progressionService.finalizeMission(this.mission.result, null);
      }
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
      this.tutorial = null;
      this.tutorialSaved = false;
      this.tutorialMap = false;
      this.shell.setTutorial(null);
    }
  }

  private rematch(): void {
    if (this.stateMachine.state !== ApplicationState.MATCH_RESULTS) return;
    if (this.mission) { this.retryMission(false); return; }
    this.returnFromResultsToSetup(true);
  }

  private returnFromResultsToSetup(startImmediately = false): void {
    if (this.stateMachine.state !== ApplicationState.MATCH_RESULTS) return;
    if (this.mission) { this.returnToMenu(); this.openCampaign(); return; }
    this.clearMatchRuntime();
    if (this.stateMachine.transitionTo(ApplicationState.MAIN_MENU) && startImmediately) this.startPractice();
  }

  private resetPractice(): void {
    if (this.stateMachine.state !== ApplicationState.PAUSED || this.matchSettings.modeId !== 'practice') {
      return;
    }
    const playerSpawn = this.mapManager?.current?.playerSpawns[0];
    this.player?.reset(playerSpawn ? [playerSpawn.position.x, playerSpawn.position.y, playerSpawn.position.z] : undefined, playerSpawn?.yaw ?? 0);
    this.playerHealth?.reset();
    this.npcManager?.reset();
    this.targetRange?.reset();
    this.weapons?.reset();
    this.ammoPickups?.reset();
    this.tacticalEquipment?.resetMatch();
    this.destructibles?.reset();
    this.interactions?.reset();
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
    if (this.campaignCustomization) { this.campaignCustomization = false; this.openCampaign(); }
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

  private changeSkin(slot: 'primary' | 'secondary', skinId: string): void {
    const loadout = this.loadoutManager.loadout;
    const weaponId = slot === 'primary' ? loadout.primaryWeaponId : loadout.secondaryWeaponId;
    if (!this.progressionService.canEquipWeaponSkin(`weapon-skin:${skinId}`, getWeaponDefinition(weaponId))) {
      this.shell.setCustomizationStatus('That finish is locked. Earn it through progression first.');
      return;
    }
    this.changeLoadout(() => slot === 'primary'
      ? this.loadoutManager.setPrimarySkin(skinId)
      : this.loadoutManager.setSecondarySkin(skinId));
  }

  private saveCustomization(): void {
    const saved = this.saveManager.save({ characterId: this.characterSelection.selectedCharacterId, appearance: this.characterSelection.appearance, loadout: this.loadoutManager.loadout });
    this.shell.setCustomizationStatus(saved ? 'Configuration saved locally.' : 'Configuration active for this session; browser storage was unavailable.');
  }

  private openProgression(section: import('../ui/AppShell').ProgressionSection): void {
    if (this.stateMachine.state !== ApplicationState.MAIN_MENU) return;
    this.shell.setProgressionProfile(this.progressionService.profile);
    this.shell.showProgression(section);
    this.shell.setProgressionVisible(true);
  }

  private equipReward(rewardId: string): void {
    const equipped = this.progressionService.equipReward(rewardId);
    this.shell.setProgressionProfile(this.progressionService.profile);
    this.shell.setProgressionStatus(equipped ? 'Reward equipped.' : 'That reward is not owned or cannot be equipped.');
  }

  private equipWeaponSkin(rewardId: string, slot: 'primary' | 'secondary'): void {
    const weaponId = slot === 'primary' ? this.loadoutManager.loadout.primaryWeaponId : this.loadoutManager.loadout.secondaryWeaponId;
    if (!rewardId.startsWith('weapon-skin:') || !this.progressionService.canEquipWeaponSkin(rewardId, getWeaponDefinition(weaponId))) {
      this.shell.setProgressionStatus('That weapon finish is not owned.');
      return;
    }
    this.changeSkin(slot, rewardId.slice('weapon-skin:'.length));
    this.saveCustomization();
    this.shell.setProgressionProfile(this.progressionService.profile);
    this.shell.setProgressionStatus(`${rewardId.slice('weapon-skin:'.length).replaceAll('-', ' ')} equipped on ${slot}.`);
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
    this.interactions?.setDefinitions(map.interactions ?? [], map.definition.doors ?? []);
    this.destructibles?.setDefinitions(map.destructibles ?? []);
    this.weapons?.applyLoadout(this.loadoutManager.loadout, this.weaponSkinRegistry);
    this.tacticalEquipment?.applyLoadout(this.loadoutManager.loadout);
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

    if (this.input?.consumeActionPressed('pause')) {
      this.pause();
      return;
    }
    if (this.input?.consumeActionPressed('scoreboard')) this.shell.toggleScoreboard();
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
      const camera = this.sceneManager?.camera;
      const throwDirection = new THREE.Vector3();
      const throwOrigin = new THREE.Vector3();
      camera?.getWorldDirection(throwDirection);
      camera?.getWorldPosition(throwOrigin);
      const npcPositions = this.npcManager?.getParticipantPositions().filter((entry) => entry.alive).map((entry) => entry.position) ?? [];
      this.interactions?.update(_deltaSeconds, [...(!this.playerHealth?.isDefeated ? [playerPosition] : []), ...npcPositions], npcPositions);
      this.tacticalEquipment?.update(_deltaSeconds);
      if (this.matchSession?.phase !== 'active') return;
      const eligible = !this.playerHealth?.isDefeated && this.player?.isPointerLocked;
      if (camera && eligible && this.input?.consumeActionPressed('tactical')) {
        const result = this.tacticalEquipment?.usePlayer('tactical', throwOrigin, throwDirection, this.matchSettings.modeId);
        if (result?.accepted) this.tutorialEquipment = true;
        if (result && !result.accepted) this.shell.showCombatMessage(`TACTICAL ${result.reason ?? 'UNAVAILABLE'}`);
      }
      if (camera && eligible && this.input?.consumeActionPressed('utility')) {
        const result = this.tacticalEquipment?.usePlayer('utility', throwOrigin, throwDirection, this.matchSettings.modeId);
        if (result && !result.accepted) this.shell.showCombatMessage(`UTILITY ${result.reason ?? 'UNAVAILABLE'}`);
      }
      if (camera && eligible && this.input?.consumeActionPressed('interact')) {
        const interaction = this.interactions?.interact(throwOrigin, throwDirection);
        if (interaction) this.tutorialInteracted = true;
        if (interaction) this.shell.showCombatMessage(interaction);
      }
      const pickupPrompt = eligible && this.weapons && this.playerHealth && this.tacticalEquipment ? this.ammoPickups?.getPrompt(playerPosition, this.weapons, this.playerHealth, this.tacticalEquipment) : null;
      this.shell.setInteractionPrompt(eligible ? this.interactions?.getPrompt(throwOrigin, throwDirection) ?? pickupPrompt ?? '' : '');
      this.npcManager?.update(_deltaSeconds, playerPosition);
      if (this.matchSession?.phase !== 'active') return;
      this.missionRuntime?.update(_deltaSeconds, playerPosition);
      if (this.mission) this.shell.setMissionSnapshot(this.mission.definition, this.mission.snapshot());
      if (this.matchSession?.phase !== 'active') return;
      for (const npc of this.npcManager?.getSnapshots() ?? []) {
        if (npc.health > 0) this.matchSession?.respawnParticipant(npc.id);
      }
      this.objectiveManager?.update(_deltaSeconds, [
        { id: 'player', teamId: 'player', alive: !this.playerHealth?.isDefeated, position: playerPosition },
        ...(this.npcManager?.getParticipantPositions() ?? []).map((participant) => ({ ...participant, teamId: participant.teamId as 'player' | 'enemy' })),
      ]);
       const minimapObjectives = this.tutorial
         ? [{ id: 'tutorial-targets', displayName: 'TARGETS', position: new THREE.Vector3(0, 0, 5), owner: null, capturingTeam: null, contested: false, progress: 0, markerKind: 'mandatory' as const }]
         : this.missionRuntime?.getMinimapStates() ?? this.objectiveManager?.getMinimapStates() ?? [];
       this.minimap?.update(playerPosition, playerSnapshot?.yaw ?? 0, this.getMinimapNPCs(playerPosition, playerSnapshot?.yaw ?? 0), minimapObjectives);
       this.updateTutorial(playerSnapshot);
    }
    this.targetRange?.update(_deltaSeconds);
    this.destructibles?.update(_deltaSeconds);
    this.weapons?.update(_deltaSeconds, this.player?.isPointerLocked ?? false);
    if (this.matchSession?.phase !== 'active') return;
    if (playerPosition && this.weapons) {
      this.ammoPickups?.update(_deltaSeconds, playerPosition, this.weapons, this.playerHealth ?? undefined, this.tacticalEquipment ?? undefined);
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
    this.shell.setEquipmentStatus(this.tacticalEquipment?.getSnapshot('tactical') ?? null, this.tacticalEquipment?.getSnapshot('utility') ?? null);
    this.shell.setTacticalFlash(this.tacticalEquipment?.getPlayerFlashRatio() ?? 0);
    this.shell.setSmokeObscuration(this.tacticalEquipment?.smokeDensity(this.sceneManager.camera.getWorldPosition(new THREE.Vector3())) ?? 0);
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

  private handleRendererContextLost(): void {
    if (this.shuttingDown) return;
    this.loop?.setSuspended(true);
    this.input?.reset();
    this.player?.exitPointerLock();
    this.stateMachine.transitionTo(ApplicationState.ERROR);
    this.shell.showError('The browser renderer lost its graphics context. Reload the page to restore the arena; local settings and progression remain stored separately.');
  }

  private handlePointerLockChanged(locked: boolean): void {
    if (locked) {
      if (this.stateMachine.state === ApplicationState.LOADING_MATCH) {
        this.stateMachine.transitionTo(ApplicationState.PLAYING);
      } else if (this.stateMachine.state === ApplicationState.PAUSED && this.resumePending) {
        this.resumePending = false;
        this.matchSession?.setPaused(false);
        this.mission?.pause(false);
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
    this.settingsService.update({ mouseSensitivity: value });
  }

  private setFieldOfView(value: number): void {
    this.settingsService.update({ fieldOfView: value });
  }

  private setHeadBobEnabled(enabled: boolean): void {
    this.settingsService.update({ headBobEnabled: enabled });
  }

  private completeOnboarding(skipped: boolean): void {
    this.settingsService.update({ onboardingCompleted: true, onboardingStatus: skipped ? 'skipped' : 'completed' });
    this.shell.hideOnboarding();
    if (!skipped) this.startTutorial();
  }
  private startTutorial(): void {
    if (this.stateMachine.state !== ApplicationState.MAIN_MENU) return;
    this.tutorialMap = true; this.tutorial = null; this.tutorialSaved = false; this.tutorialHit = false; this.tutorialReloaded = false; this.tutorialSwitched = false; this.tutorialEquipment = false; this.tutorialInteracted = false;
    this.matchSettings = createDefaultMatchSettings('practice', 'modern-city');
    this.selectedMapId = 'modern-city';
    this.shell.setMatchSettings(this.matchSettings);
    this.startPractice();
  }

  private updateTutorial(snapshot: import('../player/PlayerState').PlayerSnapshot): void {
    if (!this.tutorial || !this.input || !this.weapons) return;
    const signals: TutorialSignals = {
      player: snapshot,
      weapon: this.weapons.getHudState(),
      actionPressed: (action) => this.input?.wasActionPressed(action as import('../settings/SettingsService').ActionId) ?? false,
      fired: this.tutorialHit,
      reloaded: this.tutorialReloaded,
      switchedWeapon: this.tutorialSwitched,
      equipmentUsed: this.tutorialEquipment,
      interacted: this.tutorialInteracted,
    };
    const advanced = this.tutorial.update(signals);
    if (advanced || (this.tutorial.completed && !this.tutorialSaved)) {
      this.shell.setTutorial(this.tutorial.step, this.tutorial.progress, this.tutorial.completed);
      if (this.tutorial.completed) { this.settingsService.update({ tutorialCompleted: true }); this.tutorialSaved = true; }
    }
  }

  private applySettings(settings: GameSettings): void {
    const playerSettings: PlayerSettings = { ...settings, headBobEnabled: settings.headBobEnabled && !settings.motionReduction, cameraEffectsEnabled: settings.cameraEffectsEnabled && !settings.motionReduction };
    this.player?.applySettings(playerSettings);
    this.input?.setBindings(settings.keyBindings);
    this.weapons?.setAudioVolumes(settings.masterVolume, settings.effectsVolume);
    this.weapons?.setEffectsQuality(settings.particleQuality);
     this.weapons?.setComfort(settings.motionReduction, settings.screenShake, settings.reducedFlashes);
    this.renderer?.setGraphicsSettings?.({ renderScale: settings.renderScale });
    this.shell.setSettings(settings);
    if (this.stateMachine.state === ApplicationState.MAIN_MENU && !this.matchSession && this.matchSettings.difficulty !== settings.defaultDifficulty) {
      this.matchSettings = validateMatchSettings({ ...this.matchSettings, difficulty: settings.defaultDifficulty }, this.mapRegistry.list().map((definition) => definition.id));
      this.shell.setMatchSettings(this.matchSettings);
    }
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
      const smokeBlocked = this.tacticalEquipment?.visibility.blocksLineOfSight(playerPosition.clone().add(new THREE.Vector3(0, 1.2, 0)), snapshot.position.clone().add(new THREE.Vector3(0, 1.2, 0))) ?? false;
      return { ...snapshot, visible: snapshot.health > 0 && (Boolean(this.tacticalEquipment?.isRevealed(snapshot.id)) || (inView && obstruction === null && !smokeBlocked)) };
    });
  }

  private handleMatchEvent(event: import('../match/MatchTypes').MatchEvent): void {
    if (event.type === 'match-started') this.mission?.activate();
    if (event.type === 'match-completed') {
      if (this.matchSession && this.combatTracker) {
        const stats = this.combatTracker.snapshot();
        this.lastProgressionSummary = this.mission
          ? this.mission.result?.outcome === 'success' ? this.progressionService.finalizeMission(this.mission.result, stats) : null
          : this.progressionService.finalizeMatch(stats);
        this.shell.setProgressionProfile(this.progressionService.profile);
      }
      this.syncMatchSimulationActivity();
      this.stateMachine.transitionTo(ApplicationState.MATCH_RESULTS);
      this.player?.exitPointerLock();
      this.tacticalEquipment?.clearTransient();
    } else if (event.type === 'round-ended') {
      this.tacticalEquipment?.clearTransient();
      this.shell.setInteractionPrompt('');
    } else if (event.type === 'score-changed') {
      this.shell.showCombatMessage(`${event.teamId.toUpperCase()} +${event.amount} ${event.reason}`);
    } else if (event.type === 'objective-changed') {
      this.shell.setObjectiveStates(this.matchSession?.snapshot().objectives ?? []);
    }
  }

  private clearMatchRuntime(): void {
    this.shell.setInteractionPrompt('');
    this.unsubscribeMission?.(); this.unsubscribeMission = null;
    this.missionRuntime?.dispose(); this.missionRuntime = null;
    this.mission?.dispose(); this.mission = null;
    this.pendingMission = null; this.checkpointCombat = null;
    this.shell.setMissionMode(false);
    if (this.arenaSettings) { this.matchSettings = this.arenaSettings; this.arenaSettings = null; this.shell.setMatchSettings(this.matchSettings); }
    this.unsubscribeMatch?.();
    this.unsubscribeMatch = null;
    this.objectiveManager?.dispose();
    this.objectiveManager = null;
    this.tacticalEquipment?.resetMatch();
    this.interactions?.clear();
    this.destructibles?.clear();
    this.matchSession = null;
    this.combatTracker = null;
    this.damageSystem?.setPolicy(null);
    this.playerRespawnRemaining = 0;
    this.npcManager?.configureRoster({ modeId: 'practice', count: 0, respawnsEnabled: false });
    this.npcManager?.clearMap();
    this.targetRange?.setDefinitions([]);
    this.ammoPickups?.setDefinitions([]);
  }

  private openCampaign(error?: string): void {
    if (this.stateMachine.state !== ApplicationState.MAIN_MENU) return;
    this.shell.showCampaign(this.progressionService.profile.campaign, this.characterSelection.definition.displayName, this.loadoutManager.loadout, error);
  }
  private deployMission(id: string, difficulty: CampaignDifficulty): void {
    if (this.stateMachine.state !== ApplicationState.MAIN_MENU) return;
    try {
      validateMissionCatalog(MISSIONS, this.mapRegistry.list());
      const definition = getMission(id);
      if (!isMissionUnlocked(this.progressionService.profile.campaign, definition) || !['easy', 'normal', 'hard', 'expert'].includes(difficulty)) throw new Error('Mission or difficulty unavailable.');
      this.profileService.update((profile) => { profile.campaign.selectedMissionId = id; profile.campaign.difficulty = difficulty; });
      this.arenaSettings = { ...this.matchSettings }; this.pendingMission = { definition, difficulty };
      this.shell.setCampaignVisible(false); this.startPractice();
    } catch (error) { this.openCampaign(error instanceof Error ? error.message : 'Unable to deploy mission'); }
  }
  private retryMission(checkpoint: boolean): void {
    if (!this.mission || this.stateMachine.state !== ApplicationState.MATCH_RESULTS) return;
    const definition = this.mission.definition, difficulty = this.mission.difficulty;
    const restore = checkpoint && this.mission.checkpoint && this.checkpointCombat && this.mission.phase === 'failure'
      ? { checkpoint: this.mission.checkpoint, carry: this.mission.snapshot().statistics, combat: structuredClone(this.checkpointCombat) } : undefined;
    if (checkpoint && !restore) return;
    this.returnToMenu(Boolean(restore));
    this.arenaSettings = { ...this.matchSettings }; this.pendingMission = { definition, difficulty, restore };
    this.shell.setCampaignVisible(false); this.startPractice();
  }
  private handleMissionEvent(event: MissionEvent): void {
    if (!this.mission) return;
    if (event.type === 'checkpoint') {
      this.checkpointCombat = this.combatTracker?.snapshot() ?? null;
      this.shell.showCombatMessage('CHECKPOINT SECURED · in-session recovery available');
    } else if (event.type === 'objective-completed') {
      const objective = this.mission.definition.objectives.find((o) => o.id === event.objectiveId);
      this.shell.showCombatMessage(`COMPLETE · ${objective?.title ?? event.objectiveId}`);
    } else if (event.type === 'resolved' && event.result.outcome !== 'aborted') {
      this.matchSession?.resolve(event.result.reason, event.result.outcome === 'success' ? 'player' : null, event.result.outcome === 'success' ? 'victory' : 'defeat');
    }
  }
  private showCurrentResults(): void {
    if (!this.matchSession) return;
    if (this.mission?.result) this.shell.showMissionResults(this.mission.definition, this.mission.result, this.matchSession.snapshot(), this.lastProgressionSummary,
      this.mission.phase === 'failure' && Boolean(this.mission.checkpoint && this.checkpointCombat), this.progressionService.profile.campaign, recommendedMission(this.progressionService.profile.campaign));
    else this.shell.showResults(this.matchSession.snapshot(), this.lastProgressionSummary);
  }

}

function createDefaultMatchSnapshot(): import('../match/MatchTypes').MatchSnapshot {
  const settings = createDefaultMatchSettings('practice', 'modern-city');
  return {
    sessionId: 'none', settings, phase: 'preparing', elapsedSeconds: 0, remainingSeconds: null, countdownRemaining: 0, round: 1, roundCount: 1,
    teamScores: {}, participants: [], objectives: [], outcome: null, winnerTeamId: null, resolutionReason: null,
  };
}
