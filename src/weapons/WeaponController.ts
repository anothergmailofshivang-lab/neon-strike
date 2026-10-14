import * as THREE from 'three';
import type { InputManager } from '../engine/InputManager';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { DamageSystem } from '../combat/DamageSystem';
import { CombatEventBus } from '../combat/CombatEvents';
import { CombatEffects } from '../effects/CombatEffects';
import { WeaponAudio } from '../audio/WeaponAudio';
import { CombatTargetRegistry, HitDetection, type ShotHit } from '../combat/HitDetection';
import { RecoilController } from './RecoilController';
import { WeaponInventory } from './WeaponInventory';
import { WeaponPresentation } from './WeaponPresentation';
import type { WeaponDefinition, WeaponHudState } from './WeaponTypes';
import { createWeaponCatalog } from './WeaponDefinitions';
import type { PlayerLoadout } from '../loadouts/LoadoutTypes';
import type { WeaponSkinRegistry } from '../cosmetics/WeaponSkinRegistry';
import { validateLoadout } from '../loadouts/LoadoutValidator';
import type { CharacterDefinition, CharacterAppearance } from '../characters/CharacterTypes';

export interface WeaponControllerCallbacks {
  onRecoil: (yaw: number, pitch: number) => void;
  onAimChanged: (aiming: boolean, fovMultiplier: number) => void;
  onHitFeedback: (result: { critical: boolean; defeated: boolean; damage: number }) => void;
  getPlayerMovement: () => { horizontalSpeed: number };
}

export class WeaponController {
  public readonly events: CombatEventBus;
  private readonly input: InputManager;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly inventory: WeaponInventory;
  private readonly hitDetection: HitDetection;
  private readonly damageSystem: DamageSystem;
  private readonly effects: CombatEffects;
  private readonly presentation: WeaponPresentation;
  private readonly recoil = new RecoilController();
  private readonly audio = new WeaponAudio();
  private readonly callbacks: WeaponControllerCallbacks;
  private active = false;
  private disposed = false;
  private switchRemaining = 0;
  private switchTargetId: string | null = null;
  private burstShotsRemaining = 0;
  private burstTimer = 0;
  private spreadAccumulation = 0;
  private emptyFeedbackCooldown = 0;
  private simulationTime = 0;
  private lastAiming = false;
  private cameraRecoilEnabled = true;

  public constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    input: InputManager,
    collisionWorld: CollisionWorld,
    damageSystem: DamageSystem,
    targets: CombatTargetRegistry,
    eventBus: CombatEventBus,
    callbacks: WeaponControllerCallbacks,
  ) {
    this.input = input;
    this.camera = camera;
    this.events = eventBus;
    this.damageSystem = damageSystem;
    this.callbacks = callbacks;
    this.inventory = new WeaponInventory(createWeaponCatalog());
    this.hitDetection = new HitDetection(camera, collisionWorld, targets);
    this.effects = new CombatEffects(scene);
    this.presentation = new WeaponPresentation(camera, this.inventory.allWeaponIds.map((id) => this.inventory.getRuntime(id)?.definition).filter((definition): definition is WeaponDefinition => Boolean(definition)));
    this.presentation.equip(this.inventory.active.definition);
    this.events.emit({ type: 'weapon-equipped', weapon: this.inventory.active.definition });
  }

  public setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.presentation.setCharacterVisible(active);
    if (!active) {
      this.stopTransientActions();
    }
  }

  public async resumeAudio(): Promise<void> {
    await this.audio.resume();
  }

  public setAudioVolumes(master: number, effects: number): void { this.audio.setVolumes(master, effects); }
  public async playTestSound(): Promise<boolean> { return this.audio.playTestSound(); }
  public setEffectsQuality(quality: 'low' | 'high'): void { this.effects.setQuality(quality); }
  public setComfort(motionReduction: boolean, screenShake: boolean, reducedFlashes: boolean): void { this.cameraRecoilEnabled = screenShake; this.presentation.setComfort(motionReduction, screenShake, reducedFlashes); }

  public update(deltaSeconds: number, pointerLocked: boolean): void {
    if (this.disposed) {
      return;
    }
    const delta = Math.max(deltaSeconds, 0);
    this.simulationTime += delta;
    this.effects.update(delta);
    this.presentation.update(delta);
    const recoilRecovery = this.recoil.update(delta, this.inventory.active.definition.recoil);
    if (recoilRecovery.pitch !== 0 || recoilRecovery.yaw !== 0) {
      if (this.cameraRecoilEnabled) this.callbacks.onRecoil(-recoilRecovery.yaw, -recoilRecovery.pitch);
    }
    this.emptyFeedbackCooldown = Math.max(this.emptyFeedbackCooldown - delta, 0);
    this.spreadAccumulation = Math.max(this.spreadAccumulation - delta * this.inventory.active.definition.spread.recovery, 0);
    this.updateSwitch(delta);
    if (!this.active || !pointerLocked || this.switchRemaining > 0) {
      this.updateAim(false);
      return;
    }

    const runtime = this.inventory.active;
    const reloaded = runtime.update(delta);
    if (reloaded) {
      this.events.emit({ type: 'weapon-reloaded', weaponId: runtime.definition.id });
    }

    this.handleWeaponSelection();
    if (this.switchRemaining > 0) {
      return;
    }
    this.updateAim(this.input.isMouseHeld(2));
    if (this.input.consumeActionPressed('reload')) {
      if (runtime.startReload()) {
        this.audio.playReload();
      }
    }
    if (runtime.getSnapshot().state === 'RELOADING') {
      return;
    }

    this.updateBurst(delta);
    if (this.burstShotsRemaining > 0) {
      return;
    }
    this.handleTrigger();
    this.emitStatus();
  }

  public getHudState(): WeaponHudState {
    const snapshot = this.inventory.active.getSnapshot();
    return {
      weaponId: snapshot.weaponId,
      displayName: this.inventory.active.definition.displayName,
      magazineAmmo: snapshot.magazineAmmo,
      reserveAmmo: snapshot.reserveAmmo,
      magazineCapacity: snapshot.magazineCapacity,
      state: snapshot.state,
      reloadProgress: snapshot.reloadProgress,
      aiming: snapshot.aiming,
      movementState: null,
    };
  }

  public getLoadout(): Pick<PlayerLoadout, 'primaryWeaponId' | 'secondaryWeaponId'> {
    return this.inventory.loadout;
  }

  public applyLoadout(loadout: PlayerLoadout, skins: WeaponSkinRegistry): boolean {
    if (this.active) throw new Error('Loadouts can only be applied outside gameplay.');
    validateLoadout(loadout, createWeaponCatalog(), skins);
    this.stopTransientActions();
    if (!this.inventory.applyLoadout(loadout)) return false;
    this.inventory.reset();
    const primary = this.inventory.getRuntime(loadout.primaryWeaponId)?.definition;
    const secondary = this.inventory.getRuntime(loadout.secondaryWeaponId)?.definition;
    if (!primary || !secondary) return false;
    for (const id of this.inventory.allWeaponIds) {
      this.presentation.applySkin(id, this.inventory.getRuntime(id)!.definition, skins.get('standard'));
    }
    this.presentation.applySkin(primary.id, primary, skins.get(loadout.primarySkinId));
    this.presentation.applySkin(secondary.id, secondary, skins.get(loadout.secondarySkinId));
    this.presentation.equip(primary);
    this.events.emit({ type: 'weapon-equipped', weapon: primary });
    this.emitStatus();
    return true;
  }

  public applyCharacter(definition: CharacterDefinition, appearance: CharacterAppearance): void {
    if (this.active) throw new Error('Character appearance can only be applied outside gameplay.');
    this.presentation.applyCharacter(definition, appearance);
  }

  public addReserveAmmo(amount: number): number {
    return this.inventory.addReserveAmmo(amount);
  }

  public playTacticalCue(cue: string): void { this.audio.playTactical(cue); }
  public canResupply(): boolean { return this.inventory.canResupply(); }

  public collectAmmo(amount: number): number {
    const added = this.inventory.addReserveAmmo(amount);
    if (added > 0) {
      this.events.emit({ type: 'ammo-collected', amount: added, weaponIds: this.inventory.allWeaponIds });
    }
    return added;
  }

  public reset(): void {
    this.inventory.reset();
    this.stopTransientActions();
    this.presentation.equip(this.inventory.active.definition);
    this.recoil.reset();
    this.emitStatus();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stopTransientActions();
    this.presentation.dispose();
    this.effects.dispose();
    this.audio.dispose();
  }

  private handleWeaponSelection(): void {
    if (this.input.consumeActionPressed('primaryWeapon')) {
      this.beginSwitch(this.inventory.loadout.primaryWeaponId);
    } else if (this.input.consumeActionPressed('secondaryWeapon')) {
      this.beginSwitch(this.inventory.loadout.secondaryWeaponId);
    } else if (this.input.consumeActionPressed('nextWeapon')) {
      this.beginSwitch(this.inventory.allWeaponIds[(this.inventory.allWeaponIds.indexOf(this.inventory.active.definition.id) + 1) % this.inventory.allWeaponIds.length]);
    } else {
      const wheel = this.input.consumeMouseWheelDirection();
      if (wheel !== 0) {
        const index = this.inventory.allWeaponIds.indexOf(this.inventory.active.definition.id);
        const nextIndex = (index + (wheel > 0 ? 1 : -1) + this.inventory.allWeaponIds.length) % this.inventory.allWeaponIds.length;
        this.beginSwitch(this.inventory.allWeaponIds[nextIndex]);
      }
    }
  }

  private beginSwitch(weaponId: string): void {
    if (weaponId === this.inventory.active.definition.id || this.switchRemaining > 0) {
      return;
    }
    const target = this.inventory.getRuntime(weaponId);
    if (!target) {
      return;
    }
    this.inventory.active.setSwitching(true);
    this.switchTargetId = weaponId;
    this.switchRemaining = 0.18;
    this.burstShotsRemaining = 0;
    this.updateAim(false);
  }

  private updateSwitch(deltaSeconds: number): void {
    if (this.switchRemaining <= 0) {
      return;
    }
    this.switchRemaining = Math.max(this.switchRemaining - deltaSeconds, 0);
    if (this.switchRemaining > 0 || !this.switchTargetId) {
      return;
    }
    const targetId = this.switchTargetId;
    this.switchTargetId = null;
    this.inventory.active.setSwitching(false);
    if (this.inventory.select(targetId)) {
      this.inventory.active.setSwitching(false);
      this.presentation.equip(this.inventory.active.definition);
      this.events.emit({ type: 'weapon-switch-complete', weapon: this.inventory.active.definition });
    }
  }

  private handleTrigger(): void {
    const definition = this.inventory.active.definition;
    const triggerPressed = this.input.consumeMousePressed(0);
    const triggerHeld = this.input.isMouseHeld(0);
    if (definition.firingMode === 'automatic' || definition.firingMode === 'energy') {
      if (triggerHeld) {
        this.fireShot();
      }
    } else if (definition.firingMode === 'burst') {
      if (triggerPressed && definition.burst) {
        this.burstShotsRemaining = definition.burst.shots;
        this.burstTimer = 0;
      }
    } else if (triggerPressed) {
      this.fireShot();
    }
  }

  private updateBurst(deltaSeconds: number): void {
    if (this.burstShotsRemaining <= 0) {
      return;
    }
    const burst = this.inventory.active.definition.burst;
    if (!burst) {
      this.burstShotsRemaining = 0;
      return;
    }
    this.burstTimer -= deltaSeconds;
    if (this.burstTimer > 0) {
      return;
    }
    if (this.fireShot(burst.shots === this.burstShotsRemaining ? burst.shotInterval : burst.shotInterval)) {
      this.burstShotsRemaining -= 1;
      this.burstTimer = this.burstShotsRemaining > 0 ? burst.shotInterval : burst.recovery;
    } else {
      this.burstShotsRemaining = 0;
    }
  }

  private fireShot(cooldown = this.inventory.active.definition.fireInterval): boolean {
    const runtime = this.inventory.active;
    if (!runtime.consumeShot(cooldown)) {
      if (runtime.getSnapshot().magazineAmmo === 0 && this.emptyFeedbackCooldown === 0) {
        this.emptyFeedbackCooldown = 0.3;
        this.events.emit({ type: 'weapon-empty', weaponId: runtime.definition.id });
      }
      return false;
    }

    const definition = runtime.definition;
    const aiming = runtime.getSnapshot().aiming;
    const playerMovement = this.callbacks.getPlayerMovement();
    const spread = (definition.spread.base + this.spreadAccumulation)
      * (playerMovement.horizontalSpeed > 0.25 ? definition.spread.movingMultiplier : 1)
      * (aiming ? definition.aimDownSights.spreadMultiplier : 1);
    const pelletCount = definition.pellets?.count ?? 1;
    this.events.emit({ type: 'weapon-fired', weapon: definition, shotCount: pelletCount, sourceId: 'player' });
    const pelletSpread = spread * (definition.pellets?.spreadMultiplier ?? 1);
    let firstHit: ShotHit | null = null;
    for (let pellet = 0; pellet < pelletCount; pellet += 1) {
      const direction = this.createShotDirection(pelletSpread);
      const hit = this.hitDetection.resolveCenterShot(direction, definition.range);
      firstHit ??= hit;
      if (hit.kind === 'target' && hit.target && hit.region) {
        const result = this.damageSystem.applyWeaponHit(
          hit.target,
          definition,
          hit.region,
          hit.distance,
          hit.point,
          direction,
          this.simulationTime,
          hit.regionMultiplier * (hit.region === 'critical' ? definition.criticalHitMultiplier : 1),
        );
        if (result.applied) {
          this.callbacks.onHitFeedback(result);
          this.effects.spawnImpact(hit.point, definition.visual.energyColor, result.critical);
        }
      } else {
        this.effects.spawnImpact(hit.point, definition.visual.energyColor, false);
      }
      const muzzle = this.presentation.getMuzzleWorldPosition();
      this.effects.spawnTracer(muzzle, hit.point, definition.visual.energyColor);
    }
    this.spreadAccumulation = Math.min(this.spreadAccumulation + definition.spread.sustainedPerShot, definition.spread.maximum);
    const recoil = this.recoil.apply(definition.recoil);
    if (this.cameraRecoilEnabled) this.callbacks.onRecoil(recoil.yaw, recoil.pitch);
    this.presentation.fire(definition);
    this.audio.playShot(definition);
    if (firstHit?.kind === 'world') {
      this.events.emit({
        type: 'shot-world-impact',
        weapon: definition,
        point: { x: firstHit.point.x, y: firstHit.point.y, z: firstHit.point.z },
      });
    }
    return true;
  }

  private createShotDirection(spread: number): THREE.Vector3 {
    this.camera.getWorldDirection(directionScratch);
    if (spread <= 0) {
      return directionScratch.clone();
    }
    this.camera.getWorldDirection(forwardScratch);
    rightScratch.crossVectors(forwardScratch, this.camera.up).normalize();
    upScratch.crossVectors(rightScratch, forwardScratch).normalize();
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * spread;
    return directionScratch
      .addScaledVector(rightScratch, Math.cos(angle) * radius)
      .addScaledVector(upScratch, Math.sin(angle) * radius)
      .normalize()
      .clone();
  }

  private updateAim(held: boolean): void {
    const definition = this.inventory.active.definition;
    const aiming = held && definition.aimDownSights.supported;
    this.inventory.active.setAiming(aiming);
    if (aiming !== this.lastAiming) {
      this.lastAiming = aiming;
      this.callbacks.onAimChanged(aiming, definition.aimDownSights.fovMultiplier);
    }
  }

  private stopTransientActions(): void {
    if (this.switchTargetId) this.inventory.active.setSwitching(false);
    this.inventory.active.cancelReload();
    this.presentation.reset();
    this.burstShotsRemaining = 0;
    this.burstTimer = 0;
    this.switchRemaining = 0;
    this.switchTargetId = null;
    this.lastAiming = false;
    this.recoil.reset();
    this.inventory.active.setAiming(false);
    this.callbacks.onAimChanged(false, 1);
  }

  private emitStatus(): void {
    const snapshot = this.getHudState();
    this.events.emit({ type: 'weapon-status', status: snapshot });
  }
}

const directionScratch = new THREE.Vector3();
const forwardScratch = new THREE.Vector3();
const rightScratch = new THREE.Vector3();
const upScratch = new THREE.Vector3();
