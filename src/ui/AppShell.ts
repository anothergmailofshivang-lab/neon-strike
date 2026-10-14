import { ApplicationState } from '../app/GameState';
import { ACTION_LABELS, bindingLabel, type ActionId, type GameSettings, type SettingsService } from '../settings/SettingsService';
import type { WeaponHudState } from '../weapons/WeaponTypes';
import type { MapDefinition } from '../world/MapDefinition';
import type { CharacterAppearance, CharacterDefinition } from '../characters/CharacterTypes';
import type { PlayerLoadout } from '../loadouts/LoadoutTypes';
import type { WeaponDefinition } from '../weapons/WeaponTypes';
import type { WeaponSkinDefinition } from '../cosmetics/WeaponSkinDefinitions';
import type { GameModeDefinition } from '../match/GameModeDefinitions';
import type { GameModeId, MatchObjectiveState, MatchSnapshot } from '../match/MatchTypes';
import type { PlayerProfile, ProgressionRewardSummary } from '../progression/ProgressionTypes';
import { getLevelProgress } from '../progression/ExperienceCurve';
import { ACHIEVEMENT_DEFINITIONS } from '../progression/AchievementCatalog';
import { getChallengeDefinition } from '../progression/ChallengeCatalog';
import { listRewardDefinitions } from '../progression/RewardCatalog';
import { getMasteryTier, getMasteryTierIndex, MASTERY_THRESHOLDS, MASTERY_TIERS } from '../progression/WeaponMasteryService';
import type { EquipmentDefinition, EquipmentRuntimeSnapshot } from '../equipment/EquipmentTypes';
import { CampaignPanel, el, button } from './CampaignPanel';
import type { CampaignDifficulty, CampaignProgress, MissionDefinition, MissionResult, MissionSnapshot } from '../campaign/CampaignTypes';
import { CAMPAIGN, MISSIONS } from '../campaign/CampaignCatalog';

export type ProgressionSection = 'profile' | 'challenges' | 'achievements' | 'mastery' | 'collection';
type MenuScreen = 'setup' | 'customization' | 'progression' | 'campaign' | 'settings' | 'onboarding';

export interface AppShellCallbacks {
  onStartPractice: () => void;
  onResume: () => void;
  onReturnToMenu: () => void;
  onPause: () => void;
  onResetPractice: () => void;
  onToggleDiagnostics: () => void;
  onMouseSensitivityChange: (value: number) => void;
  onFieldOfViewChange: (value: number) => void;
  onHeadBobChange: (enabled: boolean) => void;
  settingsService: SettingsService;
  onTestSound: () => Promise<boolean>;
  onSelectMap: (mapId: string) => void;
  onSelectMode: (modeId: GameModeId) => void;
  onDifficultyChange: (difficulty: string) => void;
  onMatchDurationChange: (value: number) => void;
  onScoreLimitChange: (value: number) => void;
  onNpcCountChange: (value: number) => void;
  onRoundsChange: (value: number) => void;
  onToggleScoreboard: () => void;
  onRematch: () => void;
  onResultsSetup: () => void;
  onResultsMenu: () => void;
  onOpenCustomization: () => void;
  onCloseCustomization: () => void;
  onSelectCharacter: (characterId: string) => void;
  onSelectPalette: (paletteId: string) => void;
  onSelectOutfit: (outfitId: string) => void;
  onSelectHeadVariant: (headId: string) => void;
  onSelectPrimary: (weaponId: string) => void;
  onSelectSecondary: (weaponId: string) => void;
  onSelectTacticalEquipment: (equipmentId: string) => void;
  onSelectUtilityEquipment: (equipmentId: string) => void;
  onSelectPrimarySkin: (skinId: string) => void;
  onSelectSecondarySkin: (skinId: string) => void;
  onPreviewWeapon: (weaponId: string, skinId: string) => void;
  onResetAppearance: () => void;
  onSaveCustomization: () => void;
  onOpenProgression: (section: ProgressionSection) => void;
  onCloseProgression: () => void;
  onEquipReward: (rewardId: string) => void;
  onEquipWeaponSkin: (rewardId: string, slot: 'primary' | 'secondary') => void;
  onOpenCampaign: () => void;
  onOpenTutorial: () => void;
  onCompleteOnboarding: (skipped: boolean) => void;
  onTutorialExit: () => void;
  onCloseCampaign: () => void;
  onDeployMission: (id: string, difficulty: CampaignDifficulty) => void;
  onCampaignCustomize: () => void;
  onRetryMission: (checkpoint: boolean) => void;
  onCampaignReturn: () => void;
  onNextMission: () => void;
  showDiagnosticsControl: boolean;
}

export class AppShell {
  public readonly stage: HTMLElement;
  private startupOverlay!: HTMLElement;
  private pauseOverlay!: HTMLElement;
  private errorOverlay!: HTMLElement;
  private hud!: HTMLElement;
  private resultsOverlay!: HTMLElement;
  private scoreboardPanel!: HTMLElement;
  private minimapMount!: HTMLElement;
  private startupStatus!: HTMLElement;
  private startupProgressionSummary!: HTMLElement;
  private startupButton!: HTMLButtonElement;
  private readonly mapButtons = new Map<string, HTMLButtonElement>();
  private selectedMapName = 'Map';
  private customizationOverlay!: HTMLElement;
  private screen: MenuScreen = 'setup';
  private settingsReturn: MenuScreen = 'setup';
  private settingsOverlay!: HTMLElement;
  private settingsForm!: HTMLElement;
  private settingsStatus!: HTMLElement;
  private bindingStatus!: HTMLElement;
  private waitingBinding: ActionId | null = null;
  private focusReturn: HTMLElement | null = null;
  private readonly root: HTMLElement;
  private get customizationVisible(): boolean { return this.screen === 'customization'; }
  private customizationStatus!: HTMLElement;
  private characterDetails!: HTMLElement;
  private previewMount!: HTMLElement;
  private primarySelect!: HTMLSelectElement;
  private secondarySelect!: HTMLSelectElement;
  private primarySkinSelect!: HTMLSelectElement;
  private secondarySkinSelect!: HTMLSelectElement;
  private tacticalEquipmentSelect!: HTMLSelectElement;
  private utilityEquipmentSelect!: HTMLSelectElement;
  private readonly equipmentNotes = new Map<HTMLSelectElement, HTMLElement>();
  private paletteList!: HTMLElement;
  private outfitList!: HTMLElement;
  private headList!: HTMLElement;
  private readonly characterButtons = new Map<string, HTMLButtonElement>();
  private errorMessage!: HTMLElement;
  private stateLabel!: HTMLElement;
  private pauseStatus!: HTMLElement;
  private resetPracticeControl!: HTMLButtonElement;
  private sensitivityInput!: HTMLInputElement;
  private sensitivityValue!: HTMLElement;
  private fieldOfViewInput!: HTMLInputElement;
  private fieldOfViewValue!: HTMLElement;
  private headBobInput!: HTMLInputElement;
  private invertYInput!: HTMLInputElement;
  private sprintModeInput!: HTMLSelectElement;
  private masterVolumeInput!: HTMLInputElement;
  private effectsVolumeInput!: HTMLInputElement;
  private graphicsQualityInput!: HTMLSelectElement;
  private renderScaleInput!: HTMLInputElement;
  private particleQualityInput!: HTMLSelectElement;
  private motionReductionInput!: HTMLInputElement;
  private reducedFlashesInput!: HTMLInputElement;
  private screenShakeInput!: HTMLInputElement;
  private cameraEffectsInput!: HTMLInputElement;
  private preferredDifficultyInput!: HTMLSelectElement;
  private crosshairStyleInput!: HTMLSelectElement;
  private crosshairScaleInput!: HTMLInputElement;
  private crosshairColorInput!: HTMLInputElement;
  private crosshairOutlineInput!: HTMLInputElement;
  private hudScaleInput!: HTMLInputElement;
  private hintsInput!: HTMLInputElement;
  private bindingsPanel!: HTMLElement;
  private weaponName!: HTMLElement;
  private weaponAmmo!: HTMLElement;
  private weaponState!: HTMLElement;
  private playerHealth!: HTMLElement;
  private equipmentHud!: HTMLElement;
  private interactionPrompt!: HTMLElement;
  private tacticalFlash!: HTMLElement;
  private smokeOverlay!: HTMLElement;
  private hitMarker!: HTMLElement;
  private combatMessage!: HTMLElement;
  private hitMarkerTimer: number | null = null;
  private combatMessageTimer: number | null = null;
  private matchStatus!: HTMLElement;
  private matchScore!: HTMLElement;
  private matchTimer!: HTMLElement;
  private killFeed!: HTMLElement;
  private objectiveStatus!: HTMLElement;
  private setupSummary!: HTMLElement;
  private setupCharacterName = 'Vanguard';
  private setupPrimaryName = 'Primary';
  private setupSecondaryName = 'Secondary';
  private resultsContent!: HTMLElement;
  private progressionOverlay!: HTMLElement;
  private progressionContent!: HTMLElement;
  private progressionStatus!: HTMLElement;
  private get progressionVisible(): boolean { return this.screen === 'progression'; }
  private progressionSection: ProgressionSection = 'profile';
  private progressionProfile: PlayerProfile | null = null;
  private readonly weaponDefinitions: readonly WeaponDefinition[];
  private modeButtons = new Map<string, HTMLButtonElement>();
  private difficultySelect!: HTMLSelectElement;
  private durationInput!: HTMLInputElement;
  private scoreLimitInput!: HTMLInputElement;
  private npcCountInput!: HTMLInputElement;
  private roundsInput!: HTMLInputElement;
  private readonly callbacks: AppShellCallbacks;
  private readonly campaignPanel: CampaignPanel;
  private get campaignVisible(): boolean { return this.screen === 'campaign'; }
  private missionMode = false;
  private currentState = ApplicationState.INITIALIZING;
  private resultsActions!: HTMLElement;
  private missionResultActions!: HTMLElement;
  private missionTracker!: HTMLElement;
  private tutorialPanel!: HTMLElement;
  private tutorialTitle!: HTMLElement;
  private tutorialInstruction!: HTMLElement;
  private tutorialProgress!: HTMLElement;
  private tutorialAction!: HTMLButtonElement;
  private onboardingOverlay!: HTMLElement;
  private onboardingShown = false;
  private get onboardingVisible(): boolean { return this.onboardingShown; }
  private onboardingPage = 0;

  public constructor(
    root: HTMLElement,
    callbacks: AppShellCallbacks,
    maps: readonly MapDefinition[],
    characters: readonly CharacterDefinition[],
    weapons: readonly WeaponDefinition[],
    skins: readonly WeaponSkinDefinition[],
    modes: readonly GameModeDefinition[],
    equipment: readonly EquipmentDefinition[] = [],
  ) {
    this.callbacks = callbacks;
    this.root = root;
    this.weaponDefinitions = weapons;
    root.replaceChildren();
    root.className = 'game-shell';

    this.stage = document.createElement('main');
    this.stage.className = 'game-stage';
    this.stage.setAttribute('aria-label', 'NEON STRIKE arena');
    root.appendChild(this.stage);

    const uiLayer = document.createElement('div');
    uiLayer.className = 'ui-layer';
    root.appendChild(uiLayer);

    this.startupOverlay = this.createStartupOverlay(uiLayer, maps, modes);
    this.onboardingOverlay = this.createOnboardingOverlay(uiLayer);
    this.customizationOverlay = this.createCustomizationOverlay(uiLayer, characters, weapons, skins, equipment);
    this.progressionOverlay = this.createProgressionOverlay(uiLayer);
    this.pauseOverlay = this.createPauseOverlay(uiLayer);
    this.settingsOverlay = this.createSettingsOverlay(uiLayer);
    this.errorOverlay = this.createErrorOverlay(uiLayer);
    this.hud = this.createHud(uiLayer);
    this.tutorialPanel = this.createTutorialPanel(this.hud);
    this.resultsOverlay = this.createResultsOverlay(uiLayer);
    this.campaignPanel = new CampaignPanel(uiLayer, maps, { deploy: callbacks.onDeployMission, back: callbacks.onCloseCampaign, customize: callbacks.onCampaignCustomize });
    window.addEventListener('keydown', this.handleMenuKey, true);
    window.addEventListener('blur', this.cancelBinding);
    for (const overlay of [this.startupOverlay, this.pauseOverlay, this.resultsOverlay]) {
      overlay.querySelector('.interface-panel')?.append(button('Settings & Controls', () => this.openSettings()));
    }
  }

  public setState(state: ApplicationState): void {
    if (state !== this.currentState && state !== ApplicationState.MAIN_MENU) this.screen = 'setup';
    this.currentState = state;
    this.campaignPanel.setVisible(this.campaignVisible && state === ApplicationState.MAIN_MENU);
    this.startupOverlay.hidden = this.screen !== 'setup' || !(
      state === ApplicationState.INITIALIZING
      || state === ApplicationState.MAIN_MENU
      || state === ApplicationState.LOADING_MATCH
    );
    this.onboardingOverlay.hidden = !this.onboardingVisible || state !== ApplicationState.MAIN_MENU;
    this.settingsOverlay.hidden = this.screen !== 'settings' || ![ApplicationState.MAIN_MENU, ApplicationState.PAUSED, ApplicationState.MATCH_RESULTS].includes(state);
    this.pauseOverlay.hidden = state !== ApplicationState.PAUSED || this.screen === 'settings';
    this.errorOverlay.hidden = state !== ApplicationState.ERROR;
    this.hud.hidden = state !== ApplicationState.PLAYING;
    this.resultsOverlay.hidden = state !== ApplicationState.MATCH_RESULTS || this.screen === 'settings';
    this.customizationOverlay.hidden = !this.customizationVisible || state !== ApplicationState.MAIN_MENU;
    this.progressionOverlay.hidden = !this.progressionVisible || state !== ApplicationState.MAIN_MENU;
    if (state !== ApplicationState.PLAYING) this.scoreboardPanel.hidden = true;
    this.stateLabel.textContent = state;

    if (state === ApplicationState.INITIALIZING) {
      this.startupStatus.textContent = 'Initializing the WebGL renderer and practice scene…';
      this.startupButton.disabled = true;
      this.startupButton.textContent = 'Initializing…';
    } else if (state === ApplicationState.MAIN_MENU) {
      this.startupStatus.textContent = 'Systems online. Select a mode and arena, then capture the mouse to enter.';
      this.startupButton.disabled = false;
      this.startupButton.textContent = `Enter ${this.selectedMapName}`;
    } else if (state === ApplicationState.LOADING_MATCH) {
      this.startupStatus.textContent = 'Requesting mouse capture…';
      this.startupButton.disabled = true;
      this.startupButton.textContent = 'Capturing Mouse…';
    } else if (state === ApplicationState.PAUSED) {
      this.pauseStatus.textContent = 'Simulation is suspended. Resume will request mouse capture again.';
    } else if (state === ApplicationState.PLAYING) {
      this.startupButton.textContent = 'Capture Mouse & Enter Match';
    } else if (state === ApplicationState.MATCH_RESULTS) {
      this.startupButton.disabled = false;
    }
  }

  public setPointerLockStatus(message: string, canRetry: boolean): void {
    this.startupStatus.textContent = message;
    this.startupButton.disabled = !canRetry;
    this.startupButton.textContent = canRetry ? 'Try Again / Capture Mouse' : 'Capturing Mouse…';
  }

  public setMapSelection(mapId: string): void {
    for (const [id, button] of this.mapButtons) {
      button.classList.toggle('map-card-selected', id === mapId);
      button.setAttribute('aria-pressed', id === mapId ? 'true' : 'false');
    }
    const selected = [...this.mapButtons.entries()].find(([id]) => id === mapId)?.[1];
    if (selected) {
      this.selectedMapName = selected.dataset.mapName ?? 'Map';
      this.startupButton.textContent = `Enter ${this.selectedMapName}`;
      this.updateSetupSummary();
    }
  }

  public setModeSelection(modeId: GameModeId): void {
    for (const [id, button] of this.modeButtons) {
      const selected = id === modeId;
      button.classList.toggle('mode-card-selected', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    }
    this.updateSettingVisibility(modeId);
  }

  public setMatchSettings(settings: { modeId: GameModeId; difficulty: string; durationSeconds: number; scoreLimit: number; npcCount: number; rounds: number }): void {
    this.setModeSelection(settings.modeId);
    this.difficultySelect.value = settings.difficulty;
    this.durationInput.value = String(settings.durationSeconds / 60);
    this.scoreLimitInput.value = String(settings.scoreLimit);
    this.npcCountInput.value = String(settings.npcCount);
    this.roundsInput.value = String(settings.rounds);
    this.resetPracticeControl.hidden = settings.modeId !== 'practice';
    this.updateSetupSummary(settings);
  }

  public setMapLoadStatus(message: string, canRetry = false): void {
    this.startupStatus.textContent = message;
    this.startupButton.disabled = !canRetry;
  }

  public setCustomizationVisible(visible: boolean): void {
    this.navigate(visible ? 'customization' : 'setup');
  }

  public setProgressionVisible(visible: boolean): void {
    this.navigate(visible ? 'progression' : 'setup');
    if (visible) this.renderProgression();
  }

  public showProgression(section: ProgressionSection): void {
    this.progressionSection = section;
    this.renderProgression();
  }

  public setProgressionProfile(profile: PlayerProfile): void {
    this.progressionProfile = profile;
    const level = getLevelProgress(profile.lifetimeXp);
    if (this.startupProgressionSummary) this.startupProgressionSummary.textContent = `${profile.displayName} · LEVEL ${level.level} · ${profile.lifetimeXp} CAREER XP · ${profile.career.matchesPlayed} MATCHES`;
    this.refreshSkinAvailability();
    if (this.progressionVisible) this.renderProgression();
  }

  public setProgressionStatus(message: string): void {
    this.progressionStatus.textContent = message;
  }

  public get customizationPreviewMount(): HTMLElement {
    return this.previewMount;
  }

  public get minimapContainer(): HTMLElement {
    return this.minimapMount;
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.handleMenuKey, true);
    window.removeEventListener('blur', this.cancelBinding);
    this.cancelBinding();
    if (this.hitMarkerTimer !== null) window.clearTimeout(this.hitMarkerTimer);
    if (this.combatMessageTimer !== null) window.clearTimeout(this.combatMessageTimer);
  }

  public setCustomizationState(
    character: CharacterDefinition,
    appearance: CharacterAppearance,
    loadout: PlayerLoadout,
  ): void {
    for (const [id, button] of this.characterButtons) button.classList.toggle('character-card-selected', id === character.id);
    this.characterDetails.innerHTML = '';
    const title = document.createElement('strong');
    title.textContent = `${character.displayName} · ${character.category.toUpperCase()}`;
    const description = document.createElement('p');
    description.textContent = character.description;
    const theme = document.createElement('small');
    theme.textContent = character.visualTheme;
    this.characterDetails.append(title, description, theme);
    this.updateChoiceButtons(this.paletteList, character.palettes.map((entry) => [entry.id, entry.displayName]), appearance.paletteId, (id) => this.callbacks.onSelectPalette(id));
    this.updateChoiceButtons(this.outfitList, character.outfitVariantIds.map((id) => [id, id.replaceAll('-', ' ')]), appearance.outfitVariantId, (id) => this.callbacks.onSelectOutfit(id));
    this.updateChoiceButtons(this.headList, character.headVariantIds.map((id) => [id, id.replaceAll('-', ' ')]), appearance.headVariantId, (id) => this.callbacks.onSelectHeadVariant(id));
    this.primarySelect.value = loadout.primaryWeaponId;
    this.secondarySelect.value = loadout.secondaryWeaponId;
    this.primarySkinSelect.value = loadout.primarySkinId;
    this.secondarySkinSelect.value = loadout.secondarySkinId;
    this.tacticalEquipmentSelect.value = loadout.tacticalEquipmentId ?? 'frag-grenade';
    this.utilityEquipmentSelect.value = loadout.utilityEquipmentId ?? 'med-kit';
    for (const [select, note] of this.equipmentNotes) note.textContent = select.selectedOptions[0]?.dataset.description ?? '';
    this.setupCharacterName = character.displayName;
    this.setupPrimaryName = loadout.primaryWeaponId;
    this.setupSecondaryName = loadout.secondaryWeaponId;
    if (this.setupSummary) {
      const mode = [...this.modeButtons.entries()].find(([, button]) => button.classList.contains('mode-card-selected'))?.[0] ?? 'practice';
      this.setupSummary.textContent = `READY: ${mode.replaceAll('-', ' ').toUpperCase()} · ${this.selectedMapName} · ${character.displayName} · ${loadout.primaryWeaponId} / ${loadout.secondaryWeaponId}`;
    }
  }

  public setCustomizationStatus(message: string): void {
    this.customizationStatus.textContent = message;
  }

  public setResumeStatus(message: string): void {
    this.pauseStatus.textContent = message;
  }

  public setSettings(settings: GameSettings): void {
    this.sensitivityInput.value = String(settings.mouseSensitivity);
    this.sensitivityValue.textContent = settings.mouseSensitivity.toFixed(4);
    this.fieldOfViewInput.value = String(settings.fieldOfView);
    this.fieldOfViewValue.textContent = `${settings.fieldOfView.toFixed(0)}°`;
    this.headBobInput.checked = settings.headBobEnabled;
    this.root.querySelectorAll<HTMLInputElement>('[data-setting="mouseSensitivity"]').forEach((input) => { input.value = String(settings.mouseSensitivity); });
    this.root.querySelectorAll<HTMLInputElement>('[data-setting="fieldOfView"]').forEach((input) => { input.value = String(settings.fieldOfView); });
    this.root.querySelectorAll<HTMLInputElement>('[data-setting="headBobEnabled"]').forEach((input) => { input.checked = settings.headBobEnabled; });
    const extended = settings as GameSettings;
    if ('invertY' in extended) {
      this.invertYInput.checked = extended.invertY;
      this.sprintModeInput.value = extended.sprintMode;
      this.masterVolumeInput.value = String(extended.masterVolume);
      this.effectsVolumeInput.value = String(extended.effectsVolume);
      this.graphicsQualityInput.value = extended.graphicsQuality;
      this.renderScaleInput.value = String(extended.renderScale);
      this.particleQualityInput.value = extended.particleQuality;
      this.motionReductionInput.checked = extended.motionReduction;
      this.reducedFlashesInput.checked = extended.reducedFlashes;
      this.screenShakeInput.checked = extended.screenShake;
      this.cameraEffectsInput.checked = extended.cameraEffectsEnabled;
      this.preferredDifficultyInput.value = extended.defaultDifficulty;
      this.crosshairStyleInput.value = extended.crosshairStyle;
      this.crosshairScaleInput.value = String(extended.crosshairScale);
      this.crosshairColorInput.value = extended.crosshairColor;
      this.crosshairOutlineInput.checked = extended.crosshairOutline;
      this.hudScaleInput.value = String(extended.hudScale);
      this.hintsInput.checked = extended.showHints;
      this.renderBindings(extended.keyBindings);
      this.applyHudScale(extended.hudScale);
      this.applyCrosshair(extended);
      this.root.classList.toggle('reduced-motion', extended.motionReduction);
      this.root.classList.toggle('reduced-flashes', extended.reducedFlashes);
      this.root.querySelectorAll<HTMLElement>('.control-reference').forEach((node) => { node.textContent = this.controlReference(); });
      this.root.querySelectorAll<HTMLElement>('.hud-note').forEach((node) => { node.hidden = !extended.showHints; });
      this.settingsStatus.textContent = this.callbacks.settingsService.persisted ? 'Changes apply live and are saved locally.' : 'Active for this session. Browser storage could not save preferences. Retry saving below.';
    }
  }

  public showOnboarding(): void { this.onboardingPage = 0; this.renderOnboarding(); this.onboardingShown = true; this.screen = 'setup'; this.setState(this.currentState); }
  public hideOnboarding(): void { this.onboardingShown = false; this.navigate('setup'); }

  private applyHudScale(scale: number): void { this.hud?.style.setProperty('--hud-scale', String(scale)); }

  private applyCrosshair(settings: GameSettings): void {
    const crosshair = this.hud?.querySelector<HTMLElement>('.crosshair');
    if (!crosshair) return;
    crosshair.dataset.style = settings.crosshairStyle;
    crosshair.style.setProperty('--crosshair-scale', String(settings.crosshairScale));
    crosshair.style.setProperty('--crosshair-color', settings.crosshairColor);
    crosshair.classList.toggle('crosshair-no-outline', !settings.crosshairOutline);
  }

  private renderBindings(bindings: GameSettings['keyBindings']): void {
    if (!this.bindingsPanel) return;
    if (this.bindingsPanel.children.length) {
      for (const control of this.bindingsPanel.querySelectorAll<HTMLButtonElement>('[data-binding]')) control.textContent = bindingLabel(bindings[control.dataset.binding as ActionId]);
      return;
    }
    for (const [action, label] of Object.entries(ACTION_LABELS) as [ActionId, string][]) {
      const row = document.createElement('div'); row.className = 'binding-row';
      const name = document.createElement('span'); name.textContent = label;
      const control = document.createElement('button'); control.type = 'button'; control.className = 'choice-button'; control.textContent = bindingLabel(bindings[action]); control.dataset.binding = action; control.setAttribute('aria-label', `Rebind ${label}`);
      control.disabled = action === 'pause';
      control.addEventListener('click', () => this.beginBinding(action, control));
      row.append(name, control); this.bindingsPanel.appendChild(row);
    }
  }

  private beginBinding(action: ActionId, control: HTMLButtonElement): void {
    this.cancelBinding();
    this.waitingBinding = action;
    control.textContent = 'PRESS A KEY…';
    this.bindingStatus.textContent = `Choose a key for ${ACTION_LABELS[action]}. Escape cancels. Conflicts are rejected.`;
  }

  public setWeaponStatus(status: WeaponHudState): void {
    this.weaponName.textContent = status.displayName;
    this.weaponAmmo.textContent = `${status.magazineAmmo} / ${status.reserveAmmo}`;
    this.weaponState.textContent = status.state === 'RELOADING'
      ? `RELOADING ${Math.round(status.reloadProgress * 100)}%`
      : status.aiming ? 'AIMING' : status.state;
  }

  public setEquipmentStatus(tactical: EquipmentRuntimeSnapshot | null, utility: EquipmentRuntimeSnapshot | null): void {
    if (!this.equipmentHud) return;
    const format = (label: string, snapshot: EquipmentRuntimeSnapshot | null): string => {
      if (!snapshot) return `${label} —`;
      return `${label} ${snapshot.equipmentId.replaceAll('-', ' ').toUpperCase()} · ${snapshot.charges}${snapshot.useRemaining ? ` · RECOVERING ${snapshot.useRemaining.toFixed(1)}s` : snapshot.cooldownRemaining > 0 ? ` · ${snapshot.cooldownRemaining.toFixed(1)}s` : snapshot.ready ? ' · READY' : ' · UNAVAILABLE'}`;
    };
    const bindings = this.callbacks.settingsService.current.keyBindings;
    this.equipmentHud.textContent = `${format(bindingLabel(bindings.tactical), tactical)}  |  ${format(bindingLabel(bindings.utility), utility)}`;
  }

  public setInteractionPrompt(prompt: string): void {
    this.interactionPrompt.textContent = prompt.replaceAll('[E]', `[${bindingLabel(this.callbacks.settingsService.current.keyBindings.interact)}]`);
    this.interactionPrompt.hidden = prompt.length === 0;
  }

  public setTutorial(step: { title: string; instruction: string } | null, progress = '', complete = false): void {
    if (!step && !complete) { this.tutorialPanel.hidden = true; this.objectiveStatus.textContent = ''; return; }
    this.tutorialPanel.hidden = false;
    this.objectiveStatus.textContent = complete ? 'TRAINING COMPLETE' : 'TRAINING LOCATION · CENTRAL TARGETS';
    this.tutorialTitle.textContent = complete ? 'TUTORIAL COMPLETE' : step?.title ?? '';
    this.tutorialInstruction.textContent = complete ? 'You are ready for Campaign, Practice, and arena operations.' : this.formatTutorialInstruction(step?.instruction ?? '');
    this.tutorialProgress.textContent = complete ? 'TRAINING RECORD SAVED' : progress;
    this.tutorialAction.textContent = complete ? 'Return to Main Menu' : 'Leave Tutorial';
  }

  private formatTutorialInstruction(instruction: string): string {
    const bindings = this.callbacks.settingsService.current.keyBindings;
    return instruction
      .replace('WASD', `${bindingLabel(bindings.moveForward)}/${bindingLabel(bindings.moveLeft)}/${bindingLabel(bindings.moveBackward)}/${bindingLabel(bindings.moveRight)}`)
      .replace('Sprint', `${bindingLabel(bindings.sprint)} sprint`)
      .replace('jump', `${bindingLabel(bindings.jump)} jump`)
      .replace('interact', `${bindingLabel(bindings.interact)} interact`)
      .replace('tactical equipment charge with the current binding', `tactical equipment with ${bindingLabel(bindings.tactical)}`);
  }

  public setTacticalFlash(ratio: number): void {
    const safeRatio = Math.max(0, Math.min(ratio, 1));
    this.tacticalFlash.style.opacity = String(safeRatio * (this.callbacks.settingsService.current.reducedFlashes ? 0.1 : 0.35));
    this.tacticalFlash.textContent = safeRatio > 0 ? 'DISORIENTED' : '';
    this.tacticalFlash.hidden = safeRatio <= 0;
  }

  public setSmokeObscuration(density: number): void { this.smokeOverlay.style.opacity = String(density); this.smokeOverlay.hidden = density <= 0; }

  public setPlayerHealth(current: number, maximum: number): void {
    const safeMaximum = Math.max(maximum, 1);
    const ratio = Math.max(0, Math.min(current / safeMaximum, 1));
    this.playerHealth.textContent = `VITALS ${Math.ceil(Math.max(current, 0))} / ${Math.ceil(safeMaximum)}`;
    this.playerHealth.style.setProperty('--health-percent', `${ratio * 100}%`);
    this.playerHealth.classList.toggle('health-critical', ratio <= 0.25);
  }

  public showHitMarker(critical: boolean, defeated: boolean, damage: number): void {
    this.hitMarker.textContent = defeated ? '✦' : critical ? '✣' : '×';
    this.hitMarker.className = `hit-marker${critical ? ' hit-critical' : ''}${defeated ? ' hit-defeat' : ''}`;
    this.hitMarker.setAttribute('aria-label', `${critical ? 'Critical ' : ''}hit for ${damage.toFixed(0)} damage`);
    this.hitMarker.hidden = false;
    if (this.hitMarkerTimer !== null) {
      window.clearTimeout(this.hitMarkerTimer);
    }
    this.hitMarkerTimer = window.setTimeout(() => {
      this.hitMarker.hidden = true;
      this.hitMarkerTimer = null;
    }, defeated ? 420 : 180);
  }

  public showCombatMessage(message: string): void {
    this.combatMessage.textContent = message;
    this.combatMessage.hidden = false;
    if (this.combatMessageTimer !== null) {
      window.clearTimeout(this.combatMessageTimer);
    }
    this.combatMessageTimer = window.setTimeout(() => {
      this.combatMessage.hidden = true;
      this.combatMessageTimer = null;
    }, 1800);
  }

  public setMatchSnapshot(snapshot: MatchSnapshot): void {
    if (this.missionMode) {
      if (snapshot.phase === 'countdown') { this.matchStatus.textContent = `DEPLOYING IN ${Math.ceil(snapshot.countdownRemaining)}`; this.matchScore.textContent = 'CAMPAIGN'; this.matchTimer.textContent = ''; }
      this.updateScoreboard(snapshot); return;
    }
    const definition = snapshot.settings.modeId.replaceAll('-', ' ').toUpperCase();
    this.matchStatus.textContent = snapshot.phase === 'countdown'
      ? `STARTING IN ${Math.ceil(snapshot.countdownRemaining)}`
      : snapshot.phase === 'intermission'
        ? `ROUND ${snapshot.round} COMPLETE`
        : definition;
    const scoreEntries = Object.entries(snapshot.teamScores);
    this.matchScore.textContent = snapshot.settings.modeId === 'practice'
      ? 'TRAINING / NO SCORE'
      : `${scoreEntries.map(([team, score]) => `${team.toUpperCase()} ${score}`).join('  ·  ')}  /  ${snapshot.settings.scoreLimit}`;
    this.matchTimer.textContent = snapshot.remainingSeconds === null ? `ROUND ${snapshot.round}` : formatMatchTime(snapshot.remainingSeconds);
    this.objectiveStatus.textContent = snapshot.objectives.length > 0
      ? snapshot.objectives.map((objective) => `${objective.displayName} ${objective.contested ? 'CONTESTED' : objective.owner?.toUpperCase() ?? 'NEUTRAL'}${objective.capturingTeam ? ` ${Math.round(objective.progress * 100)}%` : ''}`).join('  ·  ')
      : snapshot.settings.modeId === 'survival' ? `ROUND ${snapshot.round} / ${snapshot.roundCount}` : '';
    this.updateScoreboard(snapshot);
  }

  public addKillFeedMessage(message: string): void {
    const item = document.createElement('div');
    item.textContent = message;
    this.killFeed.prepend(item);
    while (this.killFeed.children.length > 4) this.killFeed.lastElementChild?.remove();
    window.setTimeout(() => item.remove(), 5000);
  }

  public setObjectiveStates(objectives: readonly MatchObjectiveState[]): void {
    this.objectiveStatus.textContent = objectives.map((objective) => `${objective.displayName} ${objective.contested ? 'CONTESTED' : objective.owner?.toUpperCase() ?? 'NEUTRAL'}`).join('  ·  ');
  }

  public toggleScoreboard(): void {
    this.scoreboardPanel.hidden = !this.scoreboardPanel.hidden;
  }

  public showResults(snapshot: MatchSnapshot, progression: ProgressionRewardSummary | null = null): void {
    this.resultsActions.hidden = false; this.missionResultActions.hidden = true;
    const result = snapshot.outcome === 'victory' ? 'VICTORY' : snapshot.outcome === 'defeat' ? 'DEFEAT' : snapshot.outcome === 'draw' ? 'DRAW' : 'PRACTICE COMPLETE';
    this.resultsContent.replaceChildren();
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = `${snapshot.settings.modeId.replaceAll('-', ' ').toUpperCase()} · ${snapshot.settings.mapId.replaceAll('-', ' ').toUpperCase()}`;
    const title = document.createElement('h2');
    title.textContent = result;
    const summary = document.createElement('p');
    summary.className = 'lead';
    summary.textContent = snapshot.resolutionReason ?? 'Match complete.';
    const score = document.createElement('p');
    score.className = 'results-score';
    score.textContent = Object.entries(snapshot.teamScores).map(([team, value]) => `${team.toUpperCase()} ${value}`).join('  ·  ') || 'No competitive score';
    const player = snapshot.participants.find((participant) => participant.id === 'player');
    const stats = document.createElement('p');
    stats.className = 'results-stats';
    stats.textContent = player
      ? `${snapshot.settings.modeId === 'survival' ? `ROUND ${snapshot.round} / ${snapshot.roundCount}  ·  ` : ''}ELIMINATIONS ${player.stats.eliminations}  ·  DEATHS ${player.stats.deaths}  ·  DAMAGE ${Math.round(player.stats.damageDealt)}  ·  OBJECTIVE ${player.stats.objectiveScore}  ·  ACCURACY ${player.stats.shotsFired > 0 ? Math.round((player.stats.shotsHit / player.stats.shotsFired) * 100) : 0}%`
      : 'Training session ended.';
    this.resultsContent.append(eyebrow, title, summary, score, stats);
    if (progression) {
      const rewards = document.createElement('section');
      rewards.className = 'results-progression';
      const rewardTitle = document.createElement('p');
      rewardTitle.className = 'eyebrow';
      rewardTitle.textContent = progression.xpEarned > 0 ? `+${progression.xpEarned} XP EARNED` : 'NO CAREER XP AWARDED';
      rewards.appendChild(rewardTitle);
      const level = document.createElement('strong');
      level.textContent = `LEVEL ${progression.previousLevel} → ${progression.currentLevel}${progression.levelsGained.length > 0 ? ` · LEVEL UP ×${progression.levelsGained.length}` : ''}`;
      rewards.appendChild(level);
      const before = getLevelProgress(progression.previousXp);
      const beforeAfter = document.createElement('p');
      beforeAfter.className = 'progression-note';
      const after = getLevelProgress(progression.currentXp);
      beforeAfter.textContent = `PROGRESS ${before.capped ? 'CAP' : `${Math.round(before.fraction * 100)}%`} → ${after.capped ? 'CAP' : `${Math.round(after.fraction * 100)}%`}`;
      rewards.appendChild(beforeAfter);
      const progress = getLevelProgress(progression.currentXp);
      const bar = document.createElement('div');
      bar.className = 'progress-bar';
      const fill = document.createElement('span');
      fill.style.width = `${Math.round(progress.fraction * 100)}%`;
      bar.appendChild(fill);
      rewards.appendChild(bar);
      if (progression.breakdown.length > 0) {
        const breakdown = document.createElement('p');
        breakdown.className = 'results-breakdown';
        breakdown.textContent = progression.breakdown.map((item) => `${item.source} +${item.amount}`).join('  ·  ');
        rewards.appendChild(breakdown);
      }
      const notable = [...progression.achievementsCompleted.map((id) => `ACHIEVEMENT: ${id.replaceAll('-', ' ')}`), ...progression.challengesCompleted.map((id) => `CHALLENGE: ${id.replaceAll('-', ' ')}`), ...progression.rewardsUnlocked.map((id) => `UNLOCKED: ${id}`)];
      if (notable.length > 0) {
        const list = document.createElement('p');
        list.className = 'results-breakdown';
        list.textContent = notable.join('  ·  ');
        rewards.appendChild(list);
      }
      this.resultsContent.appendChild(rewards);
    }
  }

  public showCampaign(progress: CampaignProgress, operative: string, loadout: PlayerLoadout, error?: string): void {
    this.setProgressionVisible(false); this.campaignPanel.show(progress, operative, loadout, error); this.setCampaignVisible(true);
  }
  public setCampaignVisible(visible: boolean): void { this.navigate(visible ? 'campaign' : 'setup'); }
  public setMissionMode(enabled: boolean): void { this.missionMode = enabled; this.missionTracker.hidden = !enabled; this.missionTracker.replaceChildren(); if (enabled) this.resetPracticeControl.hidden = true; }
  public setMissionSnapshot(definition: MissionDefinition, snapshot: MissionSnapshot): void {
    this.matchStatus.textContent = definition.name.toUpperCase();
    this.matchTimer.textContent = formatMatchTime(snapshot.statistics.seconds);
    this.matchScore.textContent = `${snapshot.objectives.filter((o) => o.state === 'completed').length}/${definition.objectives.length} OBJECTIVES`;
    this.objectiveStatus.textContent = '';
    const rows = snapshot.objectives.filter((o) => o.state === 'active' || o.state === 'contested').map((state) => {
      const objective = definition.objectives.find((o) => o.id === state.id)!;
      return `${objective.optional ? 'OPTIONAL · ' : ''}${objective.title}${state.progress > 0 ? ` · ${Math.floor(state.progress * 100)}%` : ''}${objective.duration ? ` · HOLD ${Math.ceil(objective.duration * (1 - state.progress))}s` : ''}${state.state === 'contested' ? ' · CONTESTED' : ''}${objective.timeout ? ` · ${Math.max(0, Math.ceil(objective.timeout - state.elapsed))}s LEFT` : ''}`;
    });
    const text = [...rows, ...(snapshot.checkpointId ? ['CHECKPOINT AVAILABLE · recovery on failure'] : [])].join('\n');
    if (this.missionTracker.textContent !== text) this.missionTracker.textContent = text;
  }
  public showMissionResults(definition: MissionDefinition, result: MissionResult, match: MatchSnapshot, progression: ProgressionRewardSummary | null, checkpoint: boolean, progress: CampaignProgress, next: MissionDefinition): void {
    this.showResults(match, progression);
    const rewards = this.resultsContent.querySelector('.results-progression');
    this.resultsContent.replaceChildren(el('p', `${definition.chapter} · ${definition.mapId}`, 'eyebrow'), el('h2', `${result.outcome === 'success' ? 'MISSION SUCCESS' : 'MISSION FAILED'} · ${definition.name}`),
      el('p', result.outcome === 'success' ? definition.debrief : result.reason, 'lead'),
      el('p', `${result.rating.toUpperCase()} · ${formatMatchTime(result.statistics.seconds)} · HOSTILES DEFEATED ${result.statistics.eliminations} · DAMAGE TAKEN ${Math.round(result.statistics.damageTaken)} · CHECKPOINT RETRIES ${result.statistics.retries}`, 'results-stats'));
    const objectives = el('ul');
    for (const objective of definition.objectives) objectives.append(el('li', `${result.completedObjectives.includes(objective.id) ? 'COMPLETE' : 'NOT COMPLETE'} · ${objective.optional ? 'OPTIONAL · ' : ''}${objective.title}`));
    this.resultsContent.append(objectives);
    if (rewards) this.resultsContent.append(rewards);
    else this.resultsContent.append(el('p', 'No completion XP awarded. Retry the checkpoint to continue this run, or restart/leave to record the failed attempt.'));
    if (progression?.persisted === false) this.resultsContent.append(el('p', 'Progress is active for this session; browser storage was unavailable.', 'status-message'));
    const finished = MISSIONS.every((m) => progress.records[m.id]?.completedAt);
    if (result.outcome === 'success') this.resultsContent.append(el('p', finished ? CAMPAIGN.conclusion : `NEXT AVAILABLE: ${next.name}`, 'campaign-conclusion'));
    this.resultsActions.hidden = true; this.missionResultActions.hidden = false; this.missionResultActions.replaceChildren();
    if (checkpoint) this.missionResultActions.append(button('Retry Checkpoint', () => this.callbacks.onRetryMission(true), 'primary-button'));
    this.missionResultActions.append(button(result.outcome === 'success' ? 'Replay Mission' : 'Restart Mission', () => this.callbacks.onRetryMission(false)));
    if (result.outcome === 'success' && !finished) this.missionResultActions.append(button('Next Mission Briefing', this.callbacks.onNextMission, 'primary-button'));
    this.missionResultActions.append(button('Campaign Operations', this.callbacks.onCampaignReturn), button('Main Menu', this.callbacks.onResultsMenu));
  }

  public showError(message: string): void {
    this.errorMessage.textContent = message;
    this.errorOverlay.hidden = false;
    this.startupOverlay.hidden = true;
    this.pauseOverlay.hidden = true;
    this.hud.hidden = true;
  }

  private createStartupOverlay(parent: HTMLElement, maps: readonly MapDefinition[], modes: readonly GameModeDefinition[]): HTMLElement {
    const overlay = this.createOverlay(parent, 'startup-overlay');
    const content = this.createPanel(overlay);
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'PHASE 06 / MATCH SETUP';
    content.appendChild(eyebrow);

    const title = document.createElement('h1');
    title.textContent = 'NEON STRIKE';
    content.appendChild(title);

    const description = document.createElement('p');
    description.className = 'lead';
    description.textContent = 'Choose a game mode, arena, operative, and match rules before entering the arena.';
    content.appendChild(description);
    this.startupProgressionSummary = document.createElement('p');
    this.startupProgressionSummary.className = 'career-strip';
    this.startupProgressionSummary.textContent = 'PLAYER · LEVEL 1 · 0 CAREER XP · 0 MATCHES';
    content.appendChild(this.startupProgressionSummary);
    content.appendChild(button('Campaign · Carrier Zero', this.callbacks.onOpenCampaign, 'primary-button campaign-entry'));

    const modeHeading = document.createElement('p');
    modeHeading.className = 'eyebrow map-heading';
    modeHeading.textContent = 'SELECT MODE';
    content.appendChild(modeHeading);
    const modeList = document.createElement('div');
    modeList.className = 'mode-card-list';
    modes.forEach((mode) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'mode-card';
      card.dataset.modeName = mode.displayName;
      card.setAttribute('aria-pressed', 'false');
      const modeTitle = document.createElement('strong');
      modeTitle.textContent = mode.displayName;
      const detail = document.createElement('span');
      detail.textContent = mode.description;
      const condition = document.createElement('small');
      condition.textContent = mode.winCondition;
      card.append(modeTitle, detail, condition);
      card.addEventListener('click', () => this.callbacks.onSelectMode(mode.id));
      this.modeButtons.set(mode.id, card);
      modeList.appendChild(card);
    });
    content.appendChild(modeList);

    const settings = document.createElement('fieldset');
    settings.className = 'match-settings-panel';
    const legend = document.createElement('legend');
    legend.textContent = 'MATCH SETTINGS';
    settings.appendChild(legend);
    const difficultyLabel = document.createElement('label');
    difficultyLabel.textContent = 'Difficulty ';
    this.difficultySelect = document.createElement('select');
    for (const difficulty of ['easy', 'normal', 'hard', 'expert']) {
      const option = document.createElement('option');
      option.value = difficulty;
      option.textContent = difficulty.toUpperCase();
      this.difficultySelect.appendChild(option);
    }
    this.difficultySelect.addEventListener('change', () => this.callbacks.onDifficultyChange(this.difficultySelect.value));
    difficultyLabel.appendChild(this.difficultySelect);
    settings.appendChild(difficultyLabel);
    const settingInput = (label: string, initial: string, min: string, max: string, step: string, callback: (value: number) => void): HTMLInputElement => {
      const row = document.createElement('label');
      row.textContent = `${label} `;
      const input = document.createElement('input');
      input.type = 'number';
      input.value = initial;
      input.min = min;
      input.max = max;
      input.step = step;
      input.addEventListener('change', () => callback(Number(input.value)));
      row.appendChild(input);
      settings.appendChild(row);
      return input;
    };
    this.durationInput = settingInput('Minutes', '3', '0.5', '15', '0.5', (value) => this.callbacks.onMatchDurationChange(value * 60));
    this.scoreLimitInput = settingInput('Score limit', '10', '1', '500', '1', (value) => this.callbacks.onScoreLimitChange(value));
    this.npcCountInput = settingInput('NPCs', '4', '1', '8', '1', (value) => this.callbacks.onNpcCountChange(value));
    this.roundsInput = settingInput('Rounds', '3', '1', '10', '1', (value) => this.callbacks.onRoundsChange(value));
    content.appendChild(settings);
    this.setupSummary = document.createElement('p');
    this.setupSummary.className = 'setup-summary';
    content.appendChild(this.setupSummary);

    const mapHeading = document.createElement('p');
    mapHeading.className = 'eyebrow map-heading';
    mapHeading.textContent = 'SELECT ARENA';
    content.appendChild(mapHeading);
    const mapList = document.createElement('div');
    mapList.className = 'map-card-list';
    maps.forEach((map, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `map-card map-card-${index}`;
      card.dataset.mapName = map.displayName;
      card.setAttribute('aria-pressed', 'false');
      const title = document.createElement('strong');
      title.textContent = map.displayName;
      const detail = document.createElement('span');
      detail.textContent = map.description;
      const tags = document.createElement('small');
      tags.textContent = map.tacticalTags.join(' · ');
      card.append(title, detail, tags);
      card.addEventListener('click', () => this.callbacks.onSelectMap(map.id));
      this.mapButtons.set(map.id, card);
      mapList.appendChild(card);
    });
    content.appendChild(mapList);

    this.startupStatus = document.createElement('p');
    this.startupStatus.className = 'status-message';
    content.appendChild(this.startupStatus);

    this.startupButton = document.createElement('button');
    this.startupButton.className = 'primary-button';
    this.startupButton.type = 'button';
    this.startupButton.textContent = 'Enter Practice Arena';
    this.startupButton.addEventListener('click', this.callbacks.onStartPractice);
    content.appendChild(this.startupButton);

     const controls = document.createElement('p');
     controls.className = 'control-note';
     controls.textContent = 'Bindings and accessibility options are available in the pause menu. Start the interactive tutorial to learn with the real controller.';
     content.appendChild(controls);
     const tutorialButton = document.createElement('button'); tutorialButton.className = 'secondary-button'; tutorialButton.type = 'button'; tutorialButton.textContent = 'Interactive Tutorial'; tutorialButton.addEventListener('click', this.callbacks.onOpenTutorial); content.appendChild(tutorialButton);
    const customizeButton = document.createElement('button');
    customizeButton.className = 'secondary-button customization-open-button';
    customizeButton.type = 'button';
    customizeButton.textContent = 'Configure Character & Loadout';
    customizeButton.addEventListener('click', () => {
      this.setCustomizationVisible(true);
      this.callbacks.onOpenCustomization();
    });
    content.appendChild(customizeButton);
    const progressionNav = document.createElement('div');
    progressionNav.className = 'progression-nav';
    for (const [section, label] of [['profile', 'Career Profile'], ['challenges', 'Challenges'], ['achievements', 'Achievements'], ['mastery', 'Weapon Mastery'], ['collection', 'Collection']] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary-button';
      button.textContent = label;
      button.addEventListener('click', () => this.callbacks.onOpenProgression(section));
      progressionNav.appendChild(button);
    }
    content.appendChild(progressionNav);
    return overlay;
  }

  private createOnboardingOverlay(parent: HTMLElement): HTMLElement {
    const overlay = this.createOverlay(parent, 'onboarding-overlay');
    const content = this.createPanel(overlay);
    content.append(el('p', 'FIRST DEPLOYMENT', 'eyebrow'), el('h1', 'WELCOME TO NEON STRIKE'), el('p', 'A single-player first-person arena shooter with campaign operations, local combatants, loadouts, and persistent career progress.', 'lead'));
    const controls = document.createElement('div'); controls.className = 'onboarding-controls';
    controls.append(el('p', 'WASD MOVE · MOUSE LOOK · LEFT MOUSE FIRE · RIGHT MOUSE AIM', 'control-note'), el('p', 'SHIFT SPRINT · SPACE JUMP · R RELOAD · E INTERACT · G / H EQUIPMENT', 'control-note'), el('p', 'Progress and preferences are stored locally in this browser.', 'progression-note'));
    content.appendChild(controls);
    const actions = document.createElement('div'); actions.className = 'customization-actions';
    actions.append(button('Start Interactive Tutorial', () => this.callbacks.onCompleteOnboarding(false), 'primary-button'), button('Skip to Main Menu', () => this.callbacks.onCompleteOnboarding(true)), button('Settings & Controls', () => { this.hideOnboarding(); this.pauseOverlay.hidden = false; }),);
    content.appendChild(actions); return overlay;
  }

  private createSettingsOverlay(parent: HTMLElement): HTMLElement {
    const overlay = this.createOverlay(parent, 'settings-overlay');
    const panel = this.createPanel(overlay); panel.classList.add('settings-screen');
    panel.append(el('p', 'PLAYER CONFIGURATION', 'eyebrow'), el('h2', 'SETTINGS'), el('p', 'Safe controls apply immediately. Graphics changes adjust render cost only; gameplay timing and progression are unchanged.', 'lead'));
    this.settingsForm = document.createElement('div'); this.settingsForm.className = 'settings-grid';
    const fieldset = document.createElement('fieldset'); fieldset.className = 'settings-panel'; fieldset.appendChild(el('legend', 'LOOK & MOVEMENT'));
    const range = (label: string, min: string, max: string, step: string, value: string, onChange: (value: number) => void): HTMLInputElement => { const row = document.createElement('label'); row.className = 'setting-row'; row.append(document.createTextNode(`${label} `)); const input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = value; input.addEventListener('input', () => onChange(Number(input.value))); row.appendChild(input); fieldset.appendChild(row); return input; };
    this.sensitivityInput = range('Mouse sensitivity', '0.0005', '0.0088', '0.0001', '0.0022', (value) => this.callbacks.onMouseSensitivityChange(value)); this.sensitivityInput.dataset.setting = 'mouseSensitivity';
    this.sensitivityValue = document.createElement('output');
    this.fieldOfViewInput = range('Field of view', '60', '100', '1', '70', (value) => this.callbacks.onFieldOfViewChange(value)); this.fieldOfViewInput.dataset.setting = 'fieldOfView'; this.fieldOfViewValue = document.createElement('output');
    const check = (label: string, value: boolean, onChange: (value: boolean) => void): HTMLInputElement => { const row = document.createElement('label'); row.className = 'setting-checkbox'; const input = document.createElement('input'); input.type = 'checkbox'; input.checked = value; input.addEventListener('change', () => onChange(input.checked)); row.append(input, document.createTextNode(` ${label}`)); fieldset.appendChild(row); return input; };
    this.invertYInput = check('Invert vertical look', false, (value) => this.callbacks.settingsService.update({ invertY: value }));
    this.headBobInput = check('Head bob', true, (value) => this.callbacks.onHeadBobChange(value)); this.headBobInput.dataset.setting = 'headBobEnabled';
    this.cameraEffectsInput = check('Camera effects', true, (value) => this.callbacks.settingsService.update({ cameraEffectsEnabled: value }));
    const sprintRow = document.createElement('label'); sprintRow.className = 'setting-row'; sprintRow.append(document.createTextNode('Sprint behavior ')); this.sprintModeInput = document.createElement('select'); for (const mode of ['hold', 'toggle']) sprintRow.appendChild(this.option(mode)); this.sprintModeInput.addEventListener('change', () => this.callbacks.settingsService.update({ sprintMode: this.sprintModeInput.value as GameSettings['sprintMode'] })); sprintRow.appendChild(this.sprintModeInput); fieldset.appendChild(sprintRow);
    this.settingsForm.appendChild(fieldset);
    const audio = document.createElement('fieldset'); audio.className = 'settings-panel'; audio.appendChild(el('legend', 'AUDIO'));
    this.masterVolumeInput = rangeInto(audio, 'Master volume', '0', '1', '0.01', '1', (v) => this.callbacks.settingsService.update({ masterVolume: v }));
    this.effectsVolumeInput = rangeInto(audio, 'Effects volume', '0', '1', '0.01', '1', (v) => this.callbacks.settingsService.update({ effectsVolume: v }));
    const test = button('Test sound', () => { void this.callbacks.onTestSound().then((played) => { this.settingsStatus.textContent = played ? 'Audio test played.' : 'Audio is unavailable until the browser allows audio playback.'; }); }); audio.appendChild(test); this.settingsForm.appendChild(audio);
    const graphics = document.createElement('fieldset'); graphics.className = 'settings-panel'; graphics.appendChild(el('legend', 'GRAPHICS & COMFORT'));
    this.graphicsQualityInput = selectInto(graphics, 'Quality preset', ['low', 'medium', 'high', 'custom'], 'high', (v) => this.callbacks.settingsService.update({ graphicsQuality: v as GameSettings['graphicsQuality'] }));
    this.renderScaleInput = rangeInto(graphics, 'Render scale', '0.5', '1', '0.05', '1', (v) => this.callbacks.settingsService.update({ renderScale: v }));
    this.particleQualityInput = selectInto(graphics, 'Particles', ['low', 'high'], 'high', (v) => this.callbacks.settingsService.update({ particleQuality: v as GameSettings['particleQuality'] }));
    this.motionReductionInput = checkInto(graphics, 'Reduce motion', false, (v) => this.callbacks.settingsService.update({ motionReduction: v }));
    this.reducedFlashesInput = checkInto(graphics, 'Reduce flashes and shake', false, (v) => this.callbacks.settingsService.update({ reducedFlashes: v }));
    this.screenShakeInput = checkInto(graphics, 'Screen shake', true, (v) => this.callbacks.settingsService.update({ screenShake: v }));
    this.settingsForm.appendChild(graphics);
    const hud = document.createElement('fieldset'); hud.className = 'settings-panel'; hud.appendChild(el('legend', 'HUD & ACCESSIBILITY'));
    this.crosshairStyleInput = selectInto(hud, 'Crosshair', ['cross', 'dot', 'circle'], 'cross', (v) => this.callbacks.settingsService.update({ crosshairStyle: v as GameSettings['crosshairStyle'] }));
    this.crosshairScaleInput = rangeInto(hud, 'Crosshair scale', '0.6', '1.8', '0.05', '1', (v) => this.callbacks.settingsService.update({ crosshairScale: v }));
    const color = document.createElement('label'); color.className = 'setting-row'; color.append(document.createTextNode('Crosshair color ')); this.crosshairColorInput = document.createElement('input'); this.crosshairColorInput.type = 'color'; this.crosshairColorInput.value = '#e0fdff'; this.crosshairColorInput.addEventListener('input', () => this.callbacks.settingsService.update({ crosshairColor: this.crosshairColorInput.value })); color.appendChild(this.crosshairColorInput); hud.appendChild(color);
    this.crosshairOutlineInput = checkInto(hud, 'Crosshair outline', true, (v) => this.callbacks.settingsService.update({ crosshairOutline: v }));
    this.hudScaleInput = rangeInto(hud, 'HUD scale', '0.85', '1.25', '0.05', '1', (v) => this.callbacks.settingsService.update({ hudScale: v }));
    this.hintsInput = checkInto(hud, 'Contextual hints', true, (v) => this.callbacks.settingsService.update({ showHints: v }));
    this.settingsForm.appendChild(hud);
    const controls = document.createElement('fieldset'); controls.className = 'settings-panel'; controls.appendChild(el('legend', 'KEY BINDINGS'));
    this.bindingsPanel = document.createElement('div'); this.bindingsPanel.className = 'bindings-panel'; controls.appendChild(this.bindingsPanel); this.bindingStatus = el('p', 'Select a binding to remap it. Escape always cancels.', 'status-message'); controls.appendChild(this.bindingStatus); this.settingsForm.appendChild(controls);
    panel.appendChild(this.settingsForm);
    this.settingsStatus = el('p', '', 'status-message'); panel.appendChild(this.settingsStatus);
    this.preferredDifficultyInput = document.createElement('select'); for (const difficulty of ['easy', 'normal', 'hard', 'expert']) this.preferredDifficultyInput.appendChild(this.option(difficulty)); this.preferredDifficultyInput.addEventListener('change', () => this.callbacks.settingsService.update({ defaultDifficulty: this.preferredDifficultyInput.value as GameSettings['defaultDifficulty'] }));
    const difficultyRow = document.createElement('label'); difficultyRow.className = 'setting-row'; difficultyRow.append(document.createTextNode('Preferred difficulty '), this.preferredDifficultyInput); this.settingsForm.querySelector('fieldset')?.appendChild(difficultyRow);
    const actions = document.createElement('div'); actions.className = 'customization-actions'; actions.append(button('Retry Save', () => this.callbacks.settingsService.retrySave()), button('Reset Settings', () => { if (window.confirm('Reset settings only?')) this.callbacks.settingsService.resetSettings(); }), button('Restore Default Controls', () => this.callbacks.settingsService.resetControls()), button('Back', () => this.closeSettings(), 'primary-button')); panel.appendChild(actions);
    return overlay;
  }

  private option(value: string): HTMLOptionElement { const option = document.createElement('option'); option.value = value; option.textContent = value.toUpperCase(); return option; }
  private navigate(screen: MenuScreen): void { this.screen = screen; if (screen !== 'setup') this.onboardingShown = false; this.setState(this.currentState); if (screen !== 'settings') this.focusReturn?.focus(); }
  private openSettings(): void { this.settingsReturn = this.currentState === ApplicationState.PAUSED ? 'setup' : this.screen; this.focusReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null; this.navigate('settings'); this.settingsOverlay.querySelector<HTMLElement>('button')?.focus(); }
  private closeSettings(): void { this.cancelBinding(); this.navigate(this.settingsReturn); }
  private readonly cancelBinding = (): void => { this.waitingBinding = null; this.bindingStatus && (this.bindingStatus.textContent = 'Select a binding to remap it. Escape always cancels.'); this.setSettings(this.callbacks.settingsService.current); };
  private readonly handleMenuKey = (event: KeyboardEvent): void => {
    if (this.waitingBinding) { event.preventDefault(); event.stopPropagation(); if (event.code === 'Escape') { this.cancelBinding(); return; } const error = this.callbacks.settingsService.rebind(this.waitingBinding, event.code); this.bindingStatus.textContent = error ?? 'Binding updated.'; this.waitingBinding = null; this.setSettings(this.callbacks.settingsService.current); return; }
    if (event.code === 'Escape' && this.screen === 'settings') { event.preventDefault(); this.closeSettings(); }
  };
  private controlReference(): string { const b = this.callbacks.settingsService.current.keyBindings; return `Move ${bindingLabel(b.moveForward)}/${bindingLabel(b.moveLeft)}/${bindingLabel(b.moveBackward)}/${bindingLabel(b.moveRight)} · ${bindingLabel(b.sprint)} sprint · ${bindingLabel(b.jump)} jump · LMB fire · RMB aim · ${bindingLabel(b.reload)} reload · ${bindingLabel(b.interact)} interact · ${bindingLabel(b.pause)} pause`; }
  private renderOnboarding(): void {
    const panel = this.onboardingOverlay.querySelector<HTMLElement>('.interface-panel'); if (!panel) return; panel.replaceChildren();
    const pages = [{ title: 'WELCOME TO NEON STRIKE', text: 'A single-player first-person shooter with local NPC combat, campaign operations, customization, and career progression.' }, { title: 'LEARN THE BASICS', text: `${this.controlReference()}. Start the interactive tutorial to practice using the real systems.` }, { title: 'MAKE IT YOURS', text: 'Settings include sensitivity, remapping, audio, render scale, reduced motion, HUD scale, and crosshair options. Preferences and progression are local to this browser.' }];
    const page = pages[this.onboardingPage]; panel.append(el('p', 'FIRST DEPLOYMENT', 'eyebrow'), el('h1', page.title), el('p', page.text, 'lead'), el('p', `STEP ${this.onboardingPage + 1} / ${pages.length}`, 'career-strip'));
    const actions = document.createElement('div'); actions.className = 'customization-actions'; if (this.onboardingPage > 0) actions.append(button('Back', () => { this.onboardingPage--; this.renderOnboarding(); })); if (this.onboardingPage < pages.length - 1) actions.append(button('Continue', () => { this.onboardingPage++; this.renderOnboarding(); }, 'primary-button')); else actions.append(button('Start Interactive Tutorial', () => this.callbacks.onCompleteOnboarding(false), 'primary-button'), button('Skip to Main Menu', () => this.callbacks.onCompleteOnboarding(true))); actions.append(button('Settings & Controls', () => { this.openSettings(); })); panel.appendChild(actions);
  }

  private createTutorialPanel(parent: HTMLElement): HTMLElement {
    const panel = document.createElement('section'); panel.className = 'tutorial-panel'; panel.hidden = true;
    this.tutorialTitle = document.createElement('strong'); this.tutorialInstruction = document.createElement('p'); this.tutorialProgress = document.createElement('small');
    this.tutorialAction = document.createElement('button'); this.tutorialAction.type = 'button'; this.tutorialAction.className = 'hud-button'; this.tutorialAction.textContent = 'Leave Tutorial'; this.tutorialAction.addEventListener('click', this.callbacks.onTutorialExit);
    panel.append(this.tutorialTitle, this.tutorialInstruction, this.tutorialProgress, this.tutorialAction); parent.appendChild(panel); return panel;
  }

  private createCustomizationOverlay(
    parent: HTMLElement,
    characters: readonly CharacterDefinition[],
    weapons: readonly WeaponDefinition[],
    skins: readonly WeaponSkinDefinition[],
    equipment: readonly EquipmentDefinition[],
  ): HTMLElement {
    const overlay = this.createOverlay(parent, 'customization-overlay');
    const panel = this.createPanel(overlay);
    panel.classList.add('customization-panel');
    const header = document.createElement('div');
    header.className = 'customization-header';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'PHASE 05 / CHARACTER & LOADOUT';
    const title = document.createElement('h2');
    title.textContent = 'CONFIGURE OPERATIVE';
    header.append(eyebrow, title);
    panel.appendChild(header);

    const layout = document.createElement('div');
    layout.className = 'customization-layout';
    const roster = document.createElement('div');
    roster.className = 'character-roster';
    const rosterLabel = document.createElement('p');
    rosterLabel.className = 'eyebrow';
    rosterLabel.textContent = 'OPERATIVE ROSTER';
    roster.appendChild(rosterLabel);
    for (const character of characters) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'character-card';
      button.dataset.characterId = character.id;
      const name = document.createElement('strong');
      name.textContent = character.displayName;
      const detail = document.createElement('span');
      detail.textContent = character.visualTheme;
      button.append(name, detail);
      button.addEventListener('click', () => this.callbacks.onSelectCharacter(character.id));
      this.characterButtons.set(character.id, button);
      roster.appendChild(button);
    }
    layout.appendChild(roster);

    this.previewMount = document.createElement('div');
    this.previewMount.className = 'character-preview-mount';
    this.previewMount.innerHTML = '<span>3D PREVIEW</span>';
    layout.appendChild(this.previewMount);

    const details = document.createElement('div');
    details.className = 'customization-details';
    this.characterDetails = document.createElement('div');
    this.characterDetails.className = 'character-details';
    details.appendChild(this.characterDetails);
    this.paletteList = this.createChoiceSection(details, 'COLOR PALETTE');
    this.outfitList = this.createChoiceSection(details, 'OUTFIT FINISH');
    this.headList = this.createChoiceSection(details, 'HEAD VARIANT');
    details.appendChild(this.createWeaponSection('PRIMARY WEAPON', weapons.filter((weapon) => weapon.category === 'primary'), skins, true));
    details.appendChild(this.createWeaponSection('SECONDARY WEAPON', weapons.filter((weapon) => weapon.category === 'secondary'), skins, false));
    details.appendChild(this.createEquipmentSection('TACTICAL EQUIPMENT', equipment.filter((item) => item.slot === 'tactical'), true));
    details.appendChild(this.createEquipmentSection('UTILITY EQUIPMENT', equipment.filter((item) => item.slot === 'utility'), false));
    layout.appendChild(details);
    panel.appendChild(layout);

    this.customizationStatus = document.createElement('p');
    this.customizationStatus.className = 'customization-status';
    panel.appendChild(this.customizationStatus);
    const actions = document.createElement('div');
    actions.className = 'customization-actions';
    const reset = document.createElement('button');
    reset.className = 'secondary-button';
    reset.type = 'button';
    reset.textContent = 'Reset Appearance';
    reset.addEventListener('click', this.callbacks.onResetAppearance);
    const back = document.createElement('button');
    back.className = 'secondary-button';
    back.type = 'button';
    back.textContent = 'Back to Maps';
    back.addEventListener('click', () => {
      this.setCustomizationVisible(false);
      this.callbacks.onCloseCustomization();
    });
    const save = document.createElement('button');
    save.className = 'primary-button';
    save.type = 'button';
    save.textContent = 'Save Configuration';
    save.addEventListener('click', this.callbacks.onSaveCustomization);
    actions.append(reset, back, save);
    panel.appendChild(actions);
    return overlay;
  }

  private createChoiceSection(parent: HTMLElement, label: string): HTMLElement {
    const section = document.createElement('section');
    section.className = 'choice-section';
    const title = document.createElement('small');
    title.textContent = label;
    const list = document.createElement('div');
    list.className = 'choice-list';
    section.append(title, list);
    parent.appendChild(section);
    return list;
  }

  private createWeaponSection(label: string, weapons: readonly WeaponDefinition[], skins: readonly WeaponSkinDefinition[], primary: boolean): HTMLElement {
    const section = document.createElement('section');
    section.className = 'loadout-section';
    const title = document.createElement('small');
    title.textContent = label;
    const weaponSelect = document.createElement('select');
    for (const weapon of weapons) {
      const option = document.createElement('option');
      option.value = weapon.id;
      option.textContent = weapon.displayName;
      weaponSelect.appendChild(option);
    }
    const skinSelect = document.createElement('select');
    for (const skin of skins) {
      const option = document.createElement('option');
      option.value = skin.id;
      option.textContent = `${skin.displayName} skin`;
      skinSelect.appendChild(option);
    }
    weaponSelect.addEventListener('change', () => primary ? this.callbacks.onSelectPrimary(weaponSelect.value) : this.callbacks.onSelectSecondary(weaponSelect.value));
    skinSelect.addEventListener('change', () => primary ? this.callbacks.onSelectPrimarySkin(skinSelect.value) : this.callbacks.onSelectSecondarySkin(skinSelect.value));
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'choice-button';
    preview.textContent = 'Preview weapon';
    preview.addEventListener('click', () => this.callbacks.onPreviewWeapon(weaponSelect.value, skinSelect.value));
    if (primary) {
      this.primarySelect = weaponSelect;
      this.primarySkinSelect = skinSelect;
    } else {
      this.secondarySelect = weaponSelect;
      this.secondarySkinSelect = skinSelect;
    }
    section.append(title, weaponSelect, skinSelect, preview);
    return section;
  }

  private createEquipmentSection(label: string, equipment: readonly EquipmentDefinition[], tactical: boolean): HTMLElement {
    const section = document.createElement('section');
    section.className = 'loadout-section';
    const title = document.createElement('small');
    title.textContent = label;
    const select = document.createElement('select');
    select.setAttribute('aria-label', label);
    const note = document.createElement('span');
    note.className = 'equipment-note';
    this.equipmentNotes.set(select, note);
    for (const item of equipment) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.displayName} · ${item.startingCharges} charge${item.startingCharges === 1 ? '' : 's'}`;
      option.dataset.description = item.description;
      select.appendChild(option);
    }
    select.addEventListener('change', () => tactical ? this.callbacks.onSelectTacticalEquipment(select.value) : this.callbacks.onSelectUtilityEquipment(select.value));
    if (tactical) this.tacticalEquipmentSelect = select;
    else this.utilityEquipmentSelect = select;
    section.append(title, select, note);
    return section;
  }

  private createProgressionOverlay(parent: HTMLElement): HTMLElement {
    const overlay = this.createOverlay(parent, 'progression-overlay');
    const panel = this.createPanel(overlay);
    panel.classList.add('progression-panel');
    const header = document.createElement('div');
    header.className = 'customization-header';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'PHASE 07 / CAREER SYSTEM';
    const title = document.createElement('h2');
    title.textContent = 'OPERATIVE CAREER';
    header.append(eyebrow, title);
    panel.appendChild(header);

    const navigation = document.createElement('div');
    navigation.className = 'progression-tabs';
    for (const [section, label] of [['profile', 'Profile'], ['challenges', 'Challenges'], ['achievements', 'Achievements'], ['mastery', 'Mastery'], ['collection', 'Collection']] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice-button';
      button.textContent = label;
      button.addEventListener('click', () => {
        this.progressionSection = section;
        this.renderProgression();
      });
      navigation.appendChild(button);
    }
    panel.appendChild(navigation);
    this.progressionContent = document.createElement('div');
    this.progressionContent.className = 'progression-content';
    panel.appendChild(this.progressionContent);
    this.progressionStatus = document.createElement('p');
    this.progressionStatus.className = 'customization-status';
    panel.appendChild(this.progressionStatus);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'secondary-button';
    close.textContent = 'Back to Setup';
    close.addEventListener('click', this.callbacks.onCloseProgression);
    panel.appendChild(close);
    return overlay;
  }

  private renderProgression(): void {
    this.progressionContent.replaceChildren();
    const profile = this.progressionProfile;
    if (!profile) {
      this.progressionContent.textContent = 'Career profile is initializing…';
      return;
    }
    if (this.progressionSection === 'profile') this.renderProfile(profile);
    else if (this.progressionSection === 'challenges') this.renderChallenges(profile);
    else if (this.progressionSection === 'achievements') this.renderAchievements(profile);
    else if (this.progressionSection === 'mastery') this.renderMastery(profile);
    else this.renderCollection(profile);
  }

  private renderProfile(profile: PlayerProfile): void {
    const progress = getLevelProgress(profile.lifetimeXp);
    const heading = document.createElement('div');
    heading.className = 'progression-summary';
    heading.append(this.textBlock('OPERATIVE', profile.displayName), this.textBlock('LEVEL', String(progress.level)), this.textBlock('CAREER XP', String(profile.lifetimeXp)));
    this.progressionContent.appendChild(heading);
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    const fill = document.createElement('span');
    fill.style.width = `${Math.round(progress.fraction * 100)}%`;
    bar.appendChild(fill);
    this.progressionContent.appendChild(bar);
    const next = document.createElement('p');
    next.className = 'progression-note';
    next.textContent = progress.capped ? 'LEVEL CAP REACHED' : `${progress.current} / ${progress.required} XP · ${progress.remaining} XP to next level`;
    this.progressionContent.appendChild(next);

    const stats = document.createElement('div');
    stats.className = 'progression-stat-grid';
    const accuracy = profile.career.shotsFired > 0 ? Math.round((profile.career.shotsHit / profile.career.shotsFired) * 100) : 0;
    const winRate = profile.career.matchesPlayed > 0 ? Math.round((profile.career.matchesWon / profile.career.matchesPlayed) * 100) : 0;
    const kd = profile.career.deaths > 0 ? (profile.career.eliminations / profile.career.deaths).toFixed(2) : profile.career.eliminations.toFixed(2);
    const mostUsedWeaponId = Object.values(profile.weaponMastery).sort((a, b) => b.shots - a.shots)[0]?.weaponId;
    const mostUsedWeapon = this.weaponDefinitions.find((weapon) => weapon.id === mostUsedWeaponId)?.displayName ?? 'NONE';
    for (const [label, value] of [
      ['MATCHES', profile.career.matchesPlayed], ['W / L / D', `${profile.career.matchesWon} / ${profile.career.matchesLost} / ${profile.career.matchesDrawn}`],
      ['WIN RATE', `${winRate}%`], ['K / D', kd], ['ELIMINATIONS', profile.career.eliminations], ['DEATHS', profile.career.deaths],
      ['DAMAGE DEALT', Math.round(profile.career.damageDealt)], ['ACCURACY', `${accuracy}%`], ['OBJECTIVE CAPTURES', profile.career.objectiveCaptures],
      ['SURVIVAL ROUNDS', profile.career.survivalRounds], ['MOST USED', mostUsedWeapon],
      ['GADGET USES', profile.career.equipmentUses], ['FRAG ELIMINATIONS', profile.career.explosiveEliminations], ['SUPPLIES', profile.career.resourcesCollected], ['PROPS DESTROYED', profile.career.propsDestroyed],
    ] as const) stats.appendChild(this.textBlock(label, String(value)));
    this.progressionContent.appendChild(stats);
    const recent = document.createElement('p');
    recent.className = 'progression-note';
    recent.textContent = profile.matchHistory.length > 0
      ? `RECENT: ${profile.matchHistory.slice(-3).reverse().map((match) => `${match.outcome.toUpperCase()} ${(match.missionId ?? match.modeId).replaceAll('-', ' ')}`).join('  ·  ')}`
      : 'No completed career matches recorded yet.';
    this.progressionContent.appendChild(recent);
    if (profile.matchHistory.length > 0) {
      const historyHeading = document.createElement('p');
      historyHeading.className = 'eyebrow';
      historyHeading.textContent = 'RECENT MATCH HISTORY';
      this.progressionContent.appendChild(historyHeading);
      for (const match of profile.matchHistory.slice(-5).reverse()) {
        const card = document.createElement('article');
        card.className = 'progression-card';
        const title = document.createElement('strong');
        title.textContent = `${match.outcome.toUpperCase()} · ${(match.missionId ?? match.modeId).replaceAll('-', ' ')} · ${match.mapId.replaceAll('-', ' ')}`;
        const detail = document.createElement('span');
        detail.textContent = `${match.eliminations} eliminations · ${Math.round(match.damageDealt)} damage · ${match.objectiveCaptures} captures · +${match.xpEarned} XP`;
        card.append(title, detail);
        this.progressionContent.appendChild(card);
      }
    }
  }

  private renderChallenges(profile: PlayerProfile): void {
    const groups: readonly [string, readonly PlayerProfile['challenges']['daily'][number][]][] = [
      [`DAILY · UTC ${profile.challenges.dailyPeriod}`, profile.challenges.daily],
      [`WEEKLY · UTC MONDAY ${profile.challenges.weeklyPeriod.replace('week-', '')}`, profile.challenges.weekly],
      ['PERMANENT', profile.challenges.permanent],
    ];
    for (const [label, entries] of groups) {
      const section = document.createElement('section');
      section.className = 'progression-section';
      const title = document.createElement('p');
      title.className = 'eyebrow';
      title.textContent = label;
      section.appendChild(title);
      for (const progress of entries) {
        const definition = getChallengeDefinition(progress.challengeId);
        if (!definition) continue;
        const card = document.createElement('article');
        card.className = `progression-card${progress.completed ? ' progression-complete' : ''}`;
        const name = document.createElement('strong');
        name.textContent = definition.name;
        const description = document.createElement('span');
        description.textContent = `${definition.description} · +${definition.xpReward} XP`;
        const count = document.createElement('small');
        count.textContent = progress.completed ? 'COMPLETE' : `${Math.floor(progress.progress)} / ${definition.target}`;
        card.append(name, description, count);
        section.appendChild(card);
      }
      this.progressionContent.appendChild(section);
    }
  }

  private renderAchievements(profile: PlayerProfile): void {
    const completed = ACHIEVEMENT_DEFINITIONS.filter((definition) => profile.achievements[definition.id]?.completedAt).length;
    const heading = document.createElement('p');
    heading.className = 'progression-note';
    heading.textContent = `${completed} / ${ACHIEVEMENT_DEFINITIONS.length} COMPLETE · ${Math.round((completed / Math.max(ACHIEVEMENT_DEFINITIONS.length, 1)) * 100)}%`;
    this.progressionContent.appendChild(heading);
    for (const definition of ACHIEVEMENT_DEFINITIONS) {
      const state = profile.achievements[definition.id] ?? { progress: 0, completedAt: null };
      const card = document.createElement('article');
      card.className = `progression-card${state.completedAt ? ' progression-complete' : ''}`;
      const name = document.createElement('strong');
      name.textContent = state.completedAt || !definition.hidden ? definition.name : 'CLASSIFIED SIGNAL';
      const description = document.createElement('span');
      description.textContent = state.completedAt || !definition.hidden ? definition.description : 'This achievement is hidden until its signal is decoded.';
      const progress = document.createElement('small');
      progress.textContent = state.completedAt ? `COMPLETE · +${definition.xpReward} XP` : `${Math.floor(state.progress)} / ${definition.target}`;
      card.append(name, description, progress);
      this.progressionContent.appendChild(card);
    }
  }

  private renderMastery(profile: PlayerProfile): void {
    for (const weapon of this.weaponDefinitions) {
      const record = profile.weaponMastery[weapon.id];
      const xp = record?.masteryXp ?? 0;
      const tier = getMasteryTierIndex(xp);
      const next = MASTERY_THRESHOLDS[tier + 1];
      const card = document.createElement('article');
      card.className = 'progression-card';
      const name = document.createElement('strong');
      name.textContent = `${weapon.displayName} · ${MASTERY_TIERS[tier]}`;
      const stats = document.createElement('span');
      stats.textContent = `${record?.eliminations ?? 0} eliminations · ${Math.round(record?.damage ?? 0)} damage · ${record?.matchesUsed ?? 0} matches`;
      const progress = document.createElement('small');
      progress.textContent = next === undefined ? `${xp} mastery XP · MAXIMUM TIER` : `${xp} / ${next} mastery XP · ${getMasteryTier(xp)}`;
      card.append(name, stats, progress);
      this.progressionContent.appendChild(card);
    }
  }

  private renderCollection(profile: PlayerProfile): void {
    for (const reward of listRewardDefinitions()) {
      const owned = profile.entitlements.includes(reward.id);
      const equipped = reward.id === profile.equippedCosmetics.titleId || reward.id === profile.equippedCosmetics.badgeId;
      const card = document.createElement('article');
      card.className = `progression-card${owned ? ' progression-owned' : ''}`;
      const name = document.createElement('strong');
      name.textContent = reward.displayName;
      const description = document.createElement('span');
      description.textContent = `${reward.category.replace('-', ' ')} · ${owned ? 'OWNED' : reward.unlockSource}`;
      card.append(name, description);
      if (owned && (reward.category === 'title' || reward.category === 'badge')) {
        const equip = document.createElement('button');
        equip.type = 'button';
        equip.className = 'choice-button';
        equip.textContent = equipped ? 'Equipped' : `Equip ${reward.category}`;
        equip.disabled = equipped;
        equip.addEventListener('click', () => this.callbacks.onEquipReward(reward.id));
        card.appendChild(equip);
      } else if (owned && reward.category === 'weapon-skin') {
        const actions = document.createElement('div');
        actions.className = 'collection-actions';
        for (const slot of ['primary', 'secondary'] as const) {
          const equip = document.createElement('button');
          equip.type = 'button';
          equip.className = 'choice-button';
          equip.textContent = `Equip ${slot}`;
          equip.addEventListener('click', () => this.callbacks.onEquipWeaponSkin(reward.id, slot));
          actions.appendChild(equip);
        }
        card.appendChild(actions);
      }
      this.progressionContent.appendChild(card);
    }
  }

  private textBlock(label: string, value: string): HTMLElement {
    const block = document.createElement('div');
    block.className = 'progression-stat';
    const labelElement = document.createElement('small');
    labelElement.textContent = label;
    const valueElement = document.createElement('strong');
    valueElement.textContent = value;
    block.append(labelElement, valueElement);
    return block;
  }

  private refreshSkinAvailability(): void {
    const profile = this.progressionProfile;
    if (!profile) return;
    for (const select of [this.primarySkinSelect, this.secondarySkinSelect]) {
      if (!select) continue;
      for (const option of [...select.options]) option.disabled = !profile.entitlements.includes(`weapon-skin:${option.value}`);
    }
  }

  private updateChoiceButtons(parent: HTMLElement, choices: readonly (readonly [string, string])[], selected: string, onSelect: (id: string) => void): void {
    parent.replaceChildren();
    for (const [id, label] of choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice-button';
      button.textContent = label;
      button.classList.toggle('choice-selected', id === selected);
      button.addEventListener('click', () => onSelect(id));
      parent.appendChild(button);
    }
  }

  private createPauseOverlay(parent: HTMLElement): HTMLElement {
    const overlay = this.createOverlay(parent, 'pause-overlay');
    const content = this.createPanel(overlay);
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'SIMULATION SUSPENDED';
    content.appendChild(eyebrow);

    const title = document.createElement('h2');
    title.textContent = 'PAUSED';
    content.appendChild(title);

    const description = document.createElement('p');
    description.className = 'lead';
    description.textContent = 'Gameplay simulation is suspended. The arena will resume without a catch-up spike.';
    content.appendChild(description);

    this.pauseStatus = document.createElement('p');
    this.pauseStatus.className = 'status-message';
    content.appendChild(this.pauseStatus);

    const resumeButton = document.createElement('button');
    resumeButton.className = 'primary-button';
    resumeButton.type = 'button';
    resumeButton.textContent = 'Resume';
    resumeButton.addEventListener('click', this.callbacks.onResume);
    content.appendChild(resumeButton);

    const menuButton = document.createElement('button');
    menuButton.className = 'secondary-button';
    menuButton.type = 'button';
    menuButton.textContent = 'Return to Menu';
    menuButton.addEventListener('click', this.callbacks.onReturnToMenu);
    content.appendChild(menuButton);

    const resetButton = document.createElement('button');
    resetButton.className = 'secondary-button';
    resetButton.type = 'button';
    resetButton.textContent = 'Reset Practice Position';
    this.resetPracticeControl = resetButton;
    resetButton.addEventListener('click', this.callbacks.onResetPractice);
    content.appendChild(resetButton);

    const settings = document.createElement('fieldset');
    settings.className = 'settings-panel';
    const legend = document.createElement('legend');
    legend.textContent = 'CONTROLLER SETTINGS';
    settings.appendChild(legend);

    const sensitivityRow = document.createElement('label');
    sensitivityRow.className = 'setting-row';
    sensitivityRow.appendChild(document.createTextNode('Mouse sensitivity '));
    this.sensitivityValue = document.createElement('output');
    sensitivityRow.appendChild(this.sensitivityValue);
    const pauseSensitivityInput = document.createElement('input');
    this.sensitivityInput = pauseSensitivityInput;
    pauseSensitivityInput.dataset.setting = 'mouseSensitivity';
    pauseSensitivityInput.type = 'range';
    pauseSensitivityInput.min = '0.0005';
    pauseSensitivityInput.max = '0.008';
    pauseSensitivityInput.step = '0.0001';
    pauseSensitivityInput.value = '0.0022';
    pauseSensitivityInput.addEventListener('input', () => {
      const value = Number(pauseSensitivityInput.value);
      this.sensitivityValue.textContent = value.toFixed(4);
      this.callbacks.onMouseSensitivityChange(value);
    });
    sensitivityRow.appendChild(pauseSensitivityInput);
    settings.appendChild(sensitivityRow);

    const fovRow = document.createElement('label');
    fovRow.className = 'setting-row';
    fovRow.appendChild(document.createTextNode('Field of view '));
    this.fieldOfViewValue = document.createElement('output');
    fovRow.appendChild(this.fieldOfViewValue);
    const pauseFieldOfViewInput = document.createElement('input');
    this.fieldOfViewInput = pauseFieldOfViewInput;
    pauseFieldOfViewInput.dataset.setting = 'fieldOfView';
    pauseFieldOfViewInput.type = 'range';
    pauseFieldOfViewInput.min = '60';
    pauseFieldOfViewInput.max = '100';
    pauseFieldOfViewInput.step = '1';
    pauseFieldOfViewInput.value = '70';
    pauseFieldOfViewInput.addEventListener('input', () => {
      const value = Number(pauseFieldOfViewInput.value);
      this.fieldOfViewValue.textContent = `${value.toFixed(0)}°`;
      this.callbacks.onFieldOfViewChange(value);
    });
    fovRow.appendChild(pauseFieldOfViewInput);
    settings.appendChild(fovRow);

    const headBobRow = document.createElement('label');
    headBobRow.className = 'setting-checkbox';
    const pauseHeadBobInput = document.createElement('input');
    this.headBobInput = pauseHeadBobInput;
    pauseHeadBobInput.dataset.setting = 'headBobEnabled';
    pauseHeadBobInput.type = 'checkbox';
    pauseHeadBobInput.checked = true;
    pauseHeadBobInput.addEventListener('change', () => this.callbacks.onHeadBobChange(pauseHeadBobInput.checked));
    headBobRow.append(pauseHeadBobInput, document.createTextNode(' Head bob'));
    settings.appendChild(headBobRow);
    const checkbox = (label: string, onChange: (enabled: boolean) => void): HTMLInputElement => {
      const row = document.createElement('label'); row.className = 'setting-checkbox';
      const input = document.createElement('input'); input.type = 'checkbox'; input.addEventListener('change', () => onChange(input.checked));
      row.append(input, document.createTextNode(` ${label}`)); settings.appendChild(row); return input;
    };
    this.invertYInput = checkbox('Invert vertical look', (enabled) => this.callbacks.settingsService.update({ invertY: enabled }));
    const sprintRow = document.createElement('label'); sprintRow.className = 'setting-row'; sprintRow.append(document.createTextNode('Sprint behavior '));
    this.sprintModeInput = document.createElement('select'); for (const mode of ['hold', 'toggle']) { const option = document.createElement('option'); option.value = mode; option.textContent = mode.toUpperCase(); this.sprintModeInput.appendChild(option); }
    this.sprintModeInput.addEventListener('change', () => this.callbacks.settingsService.update({ sprintMode: this.sprintModeInput.value as 'hold' | 'toggle' })); sprintRow.appendChild(this.sprintModeInput); settings.appendChild(sprintRow);
    const volume = (label: string, initial: string, update: (value: number) => void): HTMLInputElement => {
      const row = document.createElement('label'); row.className = 'setting-row'; row.append(document.createTextNode(`${label} `));
      const input = document.createElement('input'); input.type = 'range'; input.min = '0'; input.max = '1'; input.step = '0.01'; input.value = initial; input.addEventListener('input', () => update(Number(input.value))); row.appendChild(input); settings.appendChild(row); return input;
    };
    this.masterVolumeInput = volume('Master volume', '1', (value) => this.callbacks.settingsService.update({ masterVolume: value }));
    this.effectsVolumeInput = volume('Effects volume', '1', (value) => this.callbacks.settingsService.update({ effectsVolume: value }));
    const testSound = document.createElement('button'); testSound.type = 'button'; testSound.className = 'choice-button'; testSound.textContent = 'Test sound'; testSound.addEventListener('click', () => { void this.callbacks.onTestSound().then((played) => { testSound.textContent = played ? 'Sound played' : 'Audio unavailable'; window.setTimeout(() => { testSound.textContent = 'Test sound'; }, 1400); }); }); settings.appendChild(testSound);
    const select = (label: string, values: readonly string[], initial: string, update: (value: string) => void): HTMLSelectElement => {
      const row = document.createElement('label'); row.className = 'setting-row'; row.append(document.createTextNode(`${label} `)); const input = document.createElement('select');
      for (const value of values) { const option = document.createElement('option'); option.value = value; option.textContent = value.toUpperCase(); input.appendChild(option); }
      input.value = initial; input.addEventListener('change', () => update(input.value)); row.appendChild(input); settings.appendChild(row); return input;
    };
    this.graphicsQualityInput = select('Graphics quality', ['low', 'medium', 'high', 'custom'], 'high', (value) => this.callbacks.settingsService.update({ graphicsQuality: value as GameSettings['graphicsQuality'] }));
    this.particleQualityInput = select('Particle quality', ['low', 'high'], 'high', (value) => this.callbacks.settingsService.update({ particleQuality: value as GameSettings['particleQuality'] }));
    this.renderScaleInput = volume('Render scale', '1', (value) => this.callbacks.settingsService.update({ renderScale: value }));
    this.motionReductionInput = checkbox('Reduce motion', (enabled) => this.callbacks.settingsService.update({ motionReduction: enabled }));
    this.reducedFlashesInput = checkbox('Reduce flashes and shake', (enabled) => this.callbacks.settingsService.update({ reducedFlashes: enabled }));
    this.crosshairStyleInput = select('Crosshair', ['cross', 'dot', 'circle'], 'cross', (value) => this.callbacks.settingsService.update({ crosshairStyle: value as GameSettings['crosshairStyle'] }));
    this.crosshairScaleInput = volume('Crosshair scale', '1', (value) => this.callbacks.settingsService.update({ crosshairScale: value * 1.2 }));
    const colorRow = document.createElement('label'); colorRow.className = 'setting-row'; colorRow.append(document.createTextNode('Crosshair color ')); this.crosshairColorInput = document.createElement('input'); this.crosshairColorInput.type = 'color'; this.crosshairColorInput.value = '#e0fdff'; this.crosshairColorInput.addEventListener('input', () => this.callbacks.settingsService.update({ crosshairColor: this.crosshairColorInput.value })); colorRow.appendChild(this.crosshairColorInput); settings.appendChild(colorRow);
    this.crosshairOutlineInput = checkbox('Crosshair outline', (enabled) => this.callbacks.settingsService.update({ crosshairOutline: enabled }));
    this.hudScaleInput = volume('HUD scale', '1', (value) => this.callbacks.settingsService.update({ hudScale: 0.85 + value * 0.4 }));
    this.hintsInput = checkbox('Contextual hints', (enabled) => this.callbacks.settingsService.update({ showHints: enabled }));
    const resetSettings = document.createElement('button'); resetSettings.type = 'button'; resetSettings.className = 'secondary-button'; resetSettings.textContent = 'Reset Settings'; resetSettings.addEventListener('click', () => { if (window.confirm('Reset settings only? Progress, cosmetics, loadouts, and campaign records stay intact.')) this.callbacks.settingsService.resetSettings(); }); settings.appendChild(resetSettings);
    const resetControls = document.createElement('button'); resetControls.type = 'button'; resetControls.className = 'secondary-button'; resetControls.textContent = 'Restore Default Controls'; resetControls.addEventListener('click', () => this.callbacks.settingsService.resetControls()); settings.appendChild(resetControls);
    this.bindingsPanel = document.createElement('div'); this.bindingsPanel.className = 'bindings-panel'; settings.appendChild(this.bindingsPanel);
    content.appendChild(settings);
    return overlay;
  }

  private createErrorOverlay(parent: HTMLElement): HTMLElement {
    const overlay = this.createOverlay(parent, 'error-overlay');
    const content = this.createPanel(overlay);
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow error-eyebrow';
    eyebrow.textContent = 'INITIALIZATION ERROR';
    content.appendChild(eyebrow);

    const title = document.createElement('h2');
    title.textContent = 'NEON STRIKE COULD NOT START';
    content.appendChild(title);

    this.errorMessage = document.createElement('p');
    this.errorMessage.className = 'error-message';
    content.appendChild(this.errorMessage);

    const note = document.createElement('p');
    note.className = 'control-note';
    note.textContent = 'Check the browser console for technical details and verify that WebGL is available.';
    content.appendChild(note);
    return overlay;
  }

  private createHud(parent: HTMLElement): HTMLElement {
    const hud = document.createElement('div');
    hud.className = 'game-hud';
    parent.appendChild(hud);

    const state = document.createElement('span');
    state.className = 'hud-state';
    state.textContent = 'PLAYING';
    this.stateLabel = state;
    hud.appendChild(state);

    const note = document.createElement('span');
    note.className = 'hud-note';
    note.textContent = 'Arena combat / operative, loadout, and NPC systems';
    hud.appendChild(note);

    this.matchStatus = document.createElement('span');
    this.matchStatus.className = 'match-status-hud';
    hud.appendChild(this.matchStatus);
    this.matchScore = document.createElement('span');
    this.matchScore.className = 'match-score-hud';
    hud.appendChild(this.matchScore);
    this.matchTimer = document.createElement('span');
    this.matchTimer.className = 'match-timer-hud';
    hud.appendChild(this.matchTimer);
    this.objectiveStatus = document.createElement('span');
    this.objectiveStatus.className = 'objective-status-hud';
    hud.appendChild(this.objectiveStatus);
    this.killFeed = document.createElement('div');
    this.killFeed.className = 'kill-feed';
    hud.appendChild(this.killFeed);

    this.minimapMount = document.createElement('div');
    this.minimapMount.className = 'match-minimap';
    hud.appendChild(this.minimapMount);

    const crosshair = document.createElement('span');
    crosshair.className = 'crosshair';
    crosshair.setAttribute('aria-hidden', 'true');
    hud.appendChild(crosshair);

    this.hitMarker = document.createElement('span');
    this.hitMarker.className = 'hit-marker';
    this.hitMarker.hidden = true;
    this.hitMarker.setAttribute('aria-live', 'assertive');
    hud.appendChild(this.hitMarker);

    this.combatMessage = document.createElement('span');
    this.combatMessage.className = 'combat-message';
    this.combatMessage.hidden = true;
    hud.appendChild(this.combatMessage);

    this.tacticalFlash = document.createElement('div');
    this.tacticalFlash.className = 'tactical-flash-overlay';
    this.tacticalFlash.hidden = true;
    hud.appendChild(this.tacticalFlash);
    this.smokeOverlay = document.createElement('div');
    this.smokeOverlay.className = 'smoke-overlay';
    this.smokeOverlay.hidden = true;
    hud.appendChild(this.smokeOverlay);

    this.interactionPrompt = document.createElement('span');
    this.interactionPrompt.className = 'interaction-prompt';
    this.interactionPrompt.hidden = true;
    hud.appendChild(this.interactionPrompt);

    const weaponHud = document.createElement('div');
    weaponHud.className = 'weapon-hud';
    this.weaponName = document.createElement('strong');
    this.weaponName.textContent = 'Weapon';
    this.weaponAmmo = document.createElement('span');
    this.weaponAmmo.textContent = '0 / 0';
    this.weaponState = document.createElement('small');
    this.weaponState.textContent = 'READY';
    weaponHud.append(this.weaponName, this.weaponAmmo, this.weaponState);
    hud.appendChild(weaponHud);

    this.equipmentHud = document.createElement('div');
    this.equipmentHud.className = 'equipment-hud';
    this.equipmentHud.textContent = 'G TACTICAL —  |  H UTILITY —';
    hud.appendChild(this.equipmentHud);

    this.playerHealth = document.createElement('span');
    this.playerHealth.className = 'player-health-hud';
    this.playerHealth.textContent = 'VITALS 100 / 100';
    hud.appendChild(this.playerHealth);

    const diagnosticsButton = document.createElement('button');
    diagnosticsButton.className = 'hud-button';
    diagnosticsButton.type = 'button';
    diagnosticsButton.textContent = 'Toggle Diagnostics';
    diagnosticsButton.hidden = !this.callbacks.showDiagnosticsControl;
    diagnosticsButton.addEventListener('click', this.callbacks.onToggleDiagnostics);
    hud.appendChild(diagnosticsButton);

    const pauseButton = document.createElement('button');
    pauseButton.className = 'hud-button';
    pauseButton.type = 'button';
    pauseButton.textContent = 'Pause';
    pauseButton.addEventListener('click', this.callbacks.onPause);
    hud.appendChild(pauseButton);
    const scoreboardButton = document.createElement('button');
    scoreboardButton.className = 'hud-button';
    scoreboardButton.type = 'button';
    scoreboardButton.textContent = 'Scoreboard';
    scoreboardButton.addEventListener('click', this.callbacks.onToggleScoreboard);
    hud.appendChild(scoreboardButton);
    this.scoreboardPanel = document.createElement('div');
    this.scoreboardPanel.className = 'scoreboard-panel';
    this.scoreboardPanel.hidden = true;
    hud.appendChild(this.scoreboardPanel);
    this.missionTracker = el('div', '', 'mission-tracker'); this.missionTracker.hidden = true;
    this.missionTracker.setAttribute('aria-label', 'Active mission objectives'); hud.appendChild(this.missionTracker);
    return hud;
  }

  private createResultsOverlay(parent: HTMLElement): HTMLElement {
    const overlay = this.createOverlay(parent, 'results-overlay');
    const panel = this.createPanel(overlay);
    this.resultsContent = document.createElement('div');
    panel.appendChild(this.resultsContent);
    const actions = document.createElement('div');
    this.resultsActions = actions;
    actions.className = 'customization-actions';
    const rematch = document.createElement('button');
    rematch.className = 'primary-button';
    rematch.type = 'button';
    rematch.textContent = 'Rematch';
    rematch.addEventListener('click', this.callbacks.onRematch);
    const setup = document.createElement('button');
    setup.className = 'secondary-button';
    setup.type = 'button';
    setup.textContent = 'Change Setup';
    setup.addEventListener('click', this.callbacks.onResultsSetup);
    const menu = document.createElement('button');
    menu.className = 'secondary-button';
    menu.type = 'button';
    menu.textContent = 'Main Menu';
    menu.addEventListener('click', this.callbacks.onResultsMenu);
    actions.append(rematch, setup, menu);
    panel.appendChild(actions);
    this.missionResultActions = el('div', '', 'customization-actions'); this.missionResultActions.hidden = true; panel.appendChild(this.missionResultActions);
    return overlay;
  }

  private updateSettingVisibility(modeId: GameModeId): void {
    const practice = modeId === 'practice';
    const survival = modeId === 'survival';
    this.durationInput.parentElement!.hidden = practice || survival;
    this.scoreLimitInput.parentElement!.hidden = practice || survival;
    this.npcCountInput.parentElement!.hidden = practice;
    this.roundsInput.parentElement!.hidden = !survival;
  }

  private updateSetupSummary(settings?: { modeId: GameModeId; difficulty: string; durationSeconds: number; scoreLimit: number; npcCount: number; rounds: number }): void {
    if (!this.setupSummary) return;
    const modeId = settings?.modeId ?? [...this.modeButtons.entries()].find(([, button]) => button.classList.contains('mode-card-selected'))?.[0] ?? 'practice';
    const mode = modeId.replaceAll('-', ' ').toUpperCase();
    const difficulty = settings?.difficulty ?? this.difficultySelect?.value ?? 'normal';
    this.setupSummary.textContent = `READY: ${mode} · ${this.selectedMapName} · ${this.setupCharacterName} · ${this.setupPrimaryName} / ${this.setupSecondaryName} · ${difficulty.toUpperCase()}`;
  }

  private updateScoreboard(snapshot: MatchSnapshot): void {
    if (this.scoreboardPanel.hidden) return;
    this.scoreboardPanel.replaceChildren();
    const heading = document.createElement('strong');
    heading.textContent = 'OPERATIVE SCOREBOARD';
    this.scoreboardPanel.appendChild(heading);
    const rows = [...snapshot.participants].sort((a, b) => b.stats.totalScore - a.stats.totalScore || b.stats.eliminations - a.stats.eliminations);
    for (const participant of rows) {
      const row = document.createElement('div');
      row.className = participant.id === 'player' ? 'scoreboard-row scoreboard-player' : 'scoreboard-row';
      row.textContent = `${participant.displayName} · ${participant.teamId.toUpperCase()} · ${participant.stats.eliminations} K · ${participant.stats.deaths} D · ${participant.stats.totalScore} P`;
      this.scoreboardPanel.appendChild(row);
    }
  }

  private createOverlay(parent: HTMLElement, className: string): HTMLElement {
    const overlay = document.createElement('section');
    overlay.className = `overlay ${className}`;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    parent.appendChild(overlay);
    return overlay;
  }

  private createPanel(overlay: HTMLElement): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'interface-panel';
    overlay.appendChild(panel);
    return panel;
  }
}

function rangeInto(
  parent: HTMLElement,
  label: string,
  min: string,
  max: string,
  step: string,
  value: string,
  onChange: (value: number) => void,
): HTMLInputElement {
  const row = document.createElement('label'); row.className = 'setting-row'; row.append(document.createTextNode(`${label} `));
  const input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = value; input.addEventListener('input', () => onChange(Number(input.value)));
  row.appendChild(input); parent.appendChild(row); return input;
}

function selectInto(parent: HTMLElement, label: string, values: readonly string[], value: string, onChange: (value: string) => void): HTMLSelectElement {
  const row = document.createElement('label'); row.className = 'setting-row'; row.append(document.createTextNode(`${label} `));
  const input = document.createElement('select'); for (const item of values) { const option = document.createElement('option'); option.value = item; option.textContent = item.toUpperCase(); input.appendChild(option); }
  input.value = value; input.addEventListener('change', () => onChange(input.value)); row.appendChild(input); parent.appendChild(row); return input;
}

function checkInto(parent: HTMLElement, label: string, value: boolean, onChange: (value: boolean) => void): HTMLInputElement {
  const row = document.createElement('label'); row.className = 'setting-checkbox'; const input = document.createElement('input'); input.type = 'checkbox'; input.checked = value; input.addEventListener('change', () => onChange(input.checked)); row.append(input, document.createTextNode(` ${label}`)); parent.appendChild(row); return input;
}

function formatMatchTime(seconds: number): string {
  const safe = Math.max(Math.floor(seconds), 0);
  return `${Math.floor(safe / 60).toString().padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`;
}
