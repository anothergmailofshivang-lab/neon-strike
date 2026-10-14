import * as THREE from 'three';
import { createWeaponModel, disposeWeaponModel, type WeaponModel } from './WeaponModelFactory';
import type { WeaponDefinition } from './WeaponTypes';
import type { WeaponSkinDefinition } from '../cosmetics/WeaponSkinDefinitions';
import { applyWeaponSkin } from '../cosmetics/WeaponSkinApplicator';
import { CharacterVisualAdapter } from '../characters/CharacterVisualAdapter';
import type { CharacterAppearance, CharacterDefinition } from '../characters/CharacterTypes';

export class WeaponPresentation {
  public readonly root = new THREE.Group();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly models = new Map<string, WeaponModel>();
  private activeModel: WeaponModel | null = null;
  private recoilOffset = 0;
  private firingFlashRemaining = 0;
  private readonly arms: CharacterVisualAdapter;
  private motionReduction = false;
  private reducedFlashes = false;
  private screenShake = true;

  public setComfort(motionReduction: boolean, screenShake: boolean, reducedFlashes: boolean): void {
    this.motionReduction = motionReduction; this.screenShake = screenShake; this.reducedFlashes = reducedFlashes;
    if (motionReduction) this.recoilOffset = 0;
    if (reducedFlashes && this.activeModel) this.activeModel.flash.visible = false;
  }

  public constructor(camera: THREE.PerspectiveCamera, definitions: readonly WeaponDefinition[]) {
    this.camera = camera;
    this.root.name = 'FirstPersonWeaponPresentation';
    this.root.position.set(0.28, -0.25, -0.55);
    this.root.rotation.set(-0.06, -0.08, 0);
    this.camera.add(this.root);
    this.arms = new CharacterVisualAdapter(this.root);
    this.arms.setVisible(false);
    for (const definition of definitions) {
      const model = createWeaponModel(definition);
      model.group.visible = false;
      this.root.add(model.group);
      this.models.set(definition.id, model);
    }
  }

  public equip(definition: WeaponDefinition): void {
    if (this.activeModel) {
      this.activeModel.group.visible = false;
    }
    this.activeModel = this.models.get(definition.id) ?? null;
    if (this.activeModel) {
      this.activeModel.group.visible = true;
    }
    this.recoilOffset = 0;
  }

  public applySkin(weaponId: string, definition: WeaponDefinition, skin: WeaponSkinDefinition): void {
    const model = this.models.get(weaponId);
    if (model) applyWeaponSkin(model, definition, skin);
  }

  public applyCharacter(definition: CharacterDefinition, appearance: CharacterAppearance): void {
    this.arms.apply(definition, appearance);
  }

  public setCharacterVisible(visible: boolean): void {
    this.arms.setVisible(visible);
  }

  public reset(): void {
    this.recoilOffset = 0;
    this.firingFlashRemaining = 0;
    for (const model of this.models.values()) model.flash.visible = false;
  }

  public fire(definition: WeaponDefinition): void {
    this.firingFlashRemaining = 0.045;
    this.recoilOffset = this.motionReduction || !this.screenShake ? 0 : Math.min(this.recoilOffset + definition.recoil.vertical * 0.35, 0.12);
    if (this.activeModel) {
      this.activeModel.flash.visible = !this.reducedFlashes;
      this.activeModel.flash.scale.setScalar(1 + Math.random() * 0.55);
    }
  }

  public update(deltaSeconds: number): void {
    const delta = Math.max(deltaSeconds, 0);
    this.recoilOffset = Math.max(this.recoilOffset - delta * 0.7, 0);
    this.firingFlashRemaining = Math.max(this.firingFlashRemaining - delta, 0);
    this.root.position.y = -0.25 - this.recoilOffset;
    this.root.position.z = -0.55 + this.recoilOffset * 0.35;
    this.arms.update(delta, this.recoilOffset);
    if (this.activeModel) {
      const muzzle = this.activeModel.muzzle as THREE.Object3D & { userData: { flash?: number } };
      muzzle.userData.flash = this.firingFlashRemaining;
      this.activeModel.flash.visible = this.firingFlashRemaining > 0 && !this.reducedFlashes;
    }
  }

  public getMuzzleWorldPosition(output = new THREE.Vector3()): THREE.Vector3 {
    if (!this.activeModel) {
      return this.camera.getWorldPosition(output);
    }
    return this.activeModel.muzzle.getWorldPosition(output);
  }

  public getMuzzleWorldDirection(output = new THREE.Vector3()): THREE.Vector3 {
    if (!this.activeModel) {
      return this.camera.getWorldDirection(output);
    }
    return this.activeModel.muzzle.getWorldDirection(output).negate();
  }

  public dispose(): void {
    this.camera.remove(this.root);
    this.arms.dispose();
    for (const model of this.models.values()) disposeWeaponModel(model);
    this.root.clear();
    this.models.clear();
  }
}
