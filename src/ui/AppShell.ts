import { ApplicationState } from '../app/GameState';
import type { PlayerSettings } from '../player/PlayerConfig';
import type { WeaponHudState } from '../weapons/WeaponTypes';
import type { MapDefinition } from '../world/MapDefinition';
import type { CharacterAppearance, CharacterDefinition } from '../characters/CharacterTypes';
import type { PlayerLoadout } from '../loadouts/LoadoutTypes';
import type { WeaponDefinition } from '../weapons/WeaponTypes';
import type { WeaponSkinDefinition } from '../cosmetics/WeaponSkinDefinitions';

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
  onSelectMap: (mapId: string) => void;
  onOpenCustomization: () => void;
  onCloseCustomization: () => void;
  onSelectCharacter: (characterId: string) => void;
  onSelectPalette: (paletteId: string) => void;
  onSelectOutfit: (outfitId: string) => void;
  onSelectHeadVariant: (headId: string) => void;
  onSelectPrimary: (weaponId: string) => void;
  onSelectSecondary: (weaponId: string) => void;
  onSelectPrimarySkin: (skinId: string) => void;
  onSelectSecondarySkin: (skinId: string) => void;
  onPreviewWeapon: (weaponId: string, skinId: string) => void;
  onResetAppearance: () => void;
  onSaveCustomization: () => void;
  showDiagnosticsControl: boolean;
}

export class AppShell {
  public readonly stage: HTMLElement;
  private startupOverlay!: HTMLElement;
  private pauseOverlay!: HTMLElement;
  private errorOverlay!: HTMLElement;
  private hud!: HTMLElement;
  private minimapMount!: HTMLElement;
  private startupStatus!: HTMLElement;
  private startupButton!: HTMLButtonElement;
  private readonly mapButtons = new Map<string, HTMLButtonElement>();
  private selectedMapName = 'Map';
  private customizationOverlay!: HTMLElement;
  private customizationVisible = false;
  private customizationStatus!: HTMLElement;
  private characterDetails!: HTMLElement;
  private previewMount!: HTMLElement;
  private primarySelect!: HTMLSelectElement;
  private secondarySelect!: HTMLSelectElement;
  private primarySkinSelect!: HTMLSelectElement;
  private secondarySkinSelect!: HTMLSelectElement;
  private paletteList!: HTMLElement;
  private outfitList!: HTMLElement;
  private headList!: HTMLElement;
  private readonly characterButtons = new Map<string, HTMLButtonElement>();
  private errorMessage!: HTMLElement;
  private stateLabel!: HTMLElement;
  private pauseStatus!: HTMLElement;
  private sensitivityInput!: HTMLInputElement;
  private sensitivityValue!: HTMLElement;
  private fieldOfViewInput!: HTMLInputElement;
  private fieldOfViewValue!: HTMLElement;
  private headBobInput!: HTMLInputElement;
  private weaponName!: HTMLElement;
  private weaponAmmo!: HTMLElement;
  private weaponState!: HTMLElement;
  private playerHealth!: HTMLElement;
  private hitMarker!: HTMLElement;
  private combatMessage!: HTMLElement;
  private hitMarkerTimer: number | null = null;
  private combatMessageTimer: number | null = null;
  private readonly callbacks: AppShellCallbacks;

  public constructor(
    root: HTMLElement,
    callbacks: AppShellCallbacks,
    maps: readonly MapDefinition[],
    characters: readonly CharacterDefinition[],
    weapons: readonly WeaponDefinition[],
    skins: readonly WeaponSkinDefinition[],
  ) {
    this.callbacks = callbacks;
    root.replaceChildren();
    root.className = 'game-shell';

    this.stage = document.createElement('main');
    this.stage.className = 'game-stage';
    this.stage.setAttribute('aria-label', 'NEON STRIKE arena');
    root.appendChild(this.stage);

    const uiLayer = document.createElement('div');
    uiLayer.className = 'ui-layer';
    root.appendChild(uiLayer);

    this.startupOverlay = this.createStartupOverlay(uiLayer, maps);
    this.customizationOverlay = this.createCustomizationOverlay(uiLayer, characters, weapons, skins);
    this.pauseOverlay = this.createPauseOverlay(uiLayer);
    this.errorOverlay = this.createErrorOverlay(uiLayer);
    this.hud = this.createHud(uiLayer);
  }

  public setState(state: ApplicationState): void {
    this.startupOverlay.hidden = this.customizationVisible || !(
      state === ApplicationState.INITIALIZING
      || state === ApplicationState.MAIN_MENU
      || state === ApplicationState.LOADING_MATCH
    );
    this.pauseOverlay.hidden = state !== ApplicationState.PAUSED;
    this.errorOverlay.hidden = state !== ApplicationState.ERROR;
    this.hud.hidden = state !== ApplicationState.PLAYING;
    this.customizationOverlay.hidden = !this.customizationVisible || state !== ApplicationState.MAIN_MENU;
    this.stateLabel.textContent = state;

    if (state === ApplicationState.INITIALIZING) {
      this.startupStatus.textContent = 'Initializing the WebGL renderer and practice scene…';
      this.startupButton.disabled = true;
      this.startupButton.textContent = 'Initializing…';
    } else if (state === ApplicationState.MAIN_MENU) {
      this.startupStatus.textContent = 'Systems online. Select an arena, then capture the mouse to enter.';
      this.startupButton.disabled = false;
      this.startupButton.textContent = `Enter ${this.selectedMapName}`;
    } else if (state === ApplicationState.LOADING_MATCH) {
      this.startupStatus.textContent = 'Requesting mouse capture…';
      this.startupButton.disabled = true;
      this.startupButton.textContent = 'Capturing Mouse…';
    } else if (state === ApplicationState.PAUSED) {
      this.pauseStatus.textContent = 'Simulation is suspended. Resume will request mouse capture again.';
    } else if (state === ApplicationState.PLAYING) {
      this.startupButton.textContent = 'Capture Mouse & Enter Practice';
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
    }
  }

  public setMapLoadStatus(message: string, canRetry = false): void {
    this.startupStatus.textContent = message;
    this.startupButton.disabled = !canRetry;
  }

  public setCustomizationVisible(visible: boolean): void {
    this.customizationVisible = visible;
    this.startupOverlay.hidden = visible;
    this.customizationOverlay.hidden = !visible;
  }

  public get customizationPreviewMount(): HTMLElement {
    return this.previewMount;
  }

  public get minimapContainer(): HTMLElement {
    return this.minimapMount;
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
  }

  public setCustomizationStatus(message: string): void {
    this.customizationStatus.textContent = message;
  }

  public setResumeStatus(message: string): void {
    this.pauseStatus.textContent = message;
  }

  public setSettings(settings: PlayerSettings): void {
    this.sensitivityInput.value = String(settings.mouseSensitivity);
    this.sensitivityValue.textContent = settings.mouseSensitivity.toFixed(4);
    this.fieldOfViewInput.value = String(settings.fieldOfView);
    this.fieldOfViewValue.textContent = `${settings.fieldOfView.toFixed(0)}°`;
    this.headBobInput.checked = settings.headBobEnabled;
  }

  public setWeaponStatus(status: WeaponHudState): void {
    this.weaponName.textContent = status.displayName;
    this.weaponAmmo.textContent = `${status.magazineAmmo} / ${status.reserveAmmo}`;
    this.weaponState.textContent = status.state === 'RELOADING'
      ? `RELOADING ${Math.round(status.reloadProgress * 100)}%`
      : status.aiming ? 'AIMING' : status.state;
  }

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

  public showError(message: string): void {
    this.errorMessage.textContent = message;
    this.errorOverlay.hidden = false;
    this.startupOverlay.hidden = true;
    this.pauseOverlay.hidden = true;
    this.hud.hidden = true;
  }

  private createStartupOverlay(parent: HTMLElement, maps: readonly MapDefinition[]): HTMLElement {
    const overlay = this.createOverlay(parent, 'startup-overlay');
    const content = this.createPanel(overlay);
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'PHASE 05 / OPERATIVE CUSTOMIZATION';
    content.appendChild(eyebrow);

    const title = document.createElement('h1');
    title.textContent = 'NEON STRIKE';
    content.appendChild(title);

    const description = document.createElement('p');
    description.className = 'lead';
    description.textContent = 'Choose an operative, tune its appearance, configure a loadout, and enter the arena.';
    content.appendChild(description);

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
    controls.textContent = 'WASD move · Shift sprint · Space jump · LMB fire · RMB aim · R reload · 1/2 select · Q or wheel cycle · Escape pauses.';
    content.appendChild(controls);
    const customizeButton = document.createElement('button');
    customizeButton.className = 'secondary-button customization-open-button';
    customizeButton.type = 'button';
    customizeButton.textContent = 'Configure Character & Loadout';
    customizeButton.addEventListener('click', () => {
      this.setCustomizationVisible(true);
      this.callbacks.onOpenCustomization();
    });
    content.appendChild(customizeButton);
    return overlay;
  }

  private createCustomizationOverlay(
    parent: HTMLElement,
    characters: readonly CharacterDefinition[],
    weapons: readonly WeaponDefinition[],
    skins: readonly WeaponSkinDefinition[],
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
    this.sensitivityInput = document.createElement('input');
    this.sensitivityInput.type = 'range';
    this.sensitivityInput.min = '0.0005';
    this.sensitivityInput.max = '0.008';
    this.sensitivityInput.step = '0.0001';
    this.sensitivityInput.value = '0.0022';
    this.sensitivityInput.addEventListener('input', () => {
      const value = Number(this.sensitivityInput.value);
      this.sensitivityValue.textContent = value.toFixed(4);
      this.callbacks.onMouseSensitivityChange(value);
    });
    sensitivityRow.appendChild(this.sensitivityInput);
    settings.appendChild(sensitivityRow);

    const fovRow = document.createElement('label');
    fovRow.className = 'setting-row';
    fovRow.appendChild(document.createTextNode('Field of view '));
    this.fieldOfViewValue = document.createElement('output');
    fovRow.appendChild(this.fieldOfViewValue);
    this.fieldOfViewInput = document.createElement('input');
    this.fieldOfViewInput.type = 'range';
    this.fieldOfViewInput.min = '60';
    this.fieldOfViewInput.max = '100';
    this.fieldOfViewInput.step = '1';
    this.fieldOfViewInput.value = '70';
    this.fieldOfViewInput.addEventListener('input', () => {
      const value = Number(this.fieldOfViewInput.value);
      this.fieldOfViewValue.textContent = `${value.toFixed(0)}°`;
      this.callbacks.onFieldOfViewChange(value);
    });
    fovRow.appendChild(this.fieldOfViewInput);
    settings.appendChild(fovRow);

    const headBobRow = document.createElement('label');
    headBobRow.className = 'setting-checkbox';
    this.headBobInput = document.createElement('input');
    this.headBobInput.type = 'checkbox';
    this.headBobInput.checked = true;
    this.headBobInput.addEventListener('change', () => this.callbacks.onHeadBobChange(this.headBobInput.checked));
    headBobRow.append(this.headBobInput, document.createTextNode(' Head bob'));
    settings.appendChild(headBobRow);
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
    return hud;
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
