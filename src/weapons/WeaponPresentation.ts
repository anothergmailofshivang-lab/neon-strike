import * as THREE from 'three';
import { createWeaponModel, type WeaponModel } from './WeaponModelFactory';
import type { WeaponDefinition } from './WeaponTypes';

export class WeaponPresentation {
  public readonly root = new THREE.Group();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly models = new Map<string, WeaponModel>();
  private activeModel: WeaponModel | null = null;
  private recoilOffset = 0;
  private firingFlashRemaining = 0;

  public constructor(camera: THREE.PerspectiveCamera, definitions: readonly WeaponDefinition[]) {
    this.camera = camera;
    this.root.name = 'FirstPersonWeaponPresentation';
    this.root.position.set(0.28, -0.25, -0.55);
    this.root.rotation.set(-0.06, -0.08, 0);
    this.camera.add(this.root);
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

  public fire(definition: WeaponDefinition): void {
    this.firingFlashRemaining = 0.045;
    this.recoilOffset = Math.min(this.recoilOffset + definition.recoil.vertical * 0.35, 0.12);
    if (this.activeModel) {
      this.activeModel.flash.visible = true;
      this.activeModel.flash.scale.setScalar(1 + Math.random() * 0.55);
    }
  }

  public update(deltaSeconds: number): void {
    const delta = Math.max(deltaSeconds, 0);
    this.recoilOffset = Math.max(this.recoilOffset - delta * 0.7, 0);
    this.firingFlashRemaining = Math.max(this.firingFlashRemaining - delta, 0);
    this.root.position.y = -0.25 - this.recoilOffset;
    this.root.position.z = -0.55 + this.recoilOffset * 0.35;
    if (this.activeModel) {
      const muzzle = this.activeModel.muzzle as THREE.Object3D & { userData: { flash?: number } };
      muzzle.userData.flash = this.firingFlashRemaining;
      this.activeModel.flash.visible = this.firingFlashRemaining > 0;
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
    this.root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else if (material) {
        material.dispose();
      }
    });
    this.root.clear();
    this.models.clear();
  }
}
