import * as THREE from 'three';
import type { CharacterAppearance, CharacterDefinition } from './CharacterTypes';
import { createCharacterVisual } from './CharacterFactory';
import { createWeaponModel, disposeWeaponModel } from '../weapons/WeaponModelFactory';
import type { WeaponDefinition } from '../weapons/WeaponTypes';
import type { WeaponSkinDefinition } from '../cosmetics/WeaponSkinDefinitions';

/** Isolated preview scene; GameApp's existing render callback draws it only while visible. */
export class CharacterPreview {
  public readonly scene = new THREE.Scene();
  public readonly camera = new THREE.PerspectiveCamera(38, 1, 0.05, 30);
  public readonly pivot = new THREE.Group();
  private releaseModel: (() => void) | null = null;
  private key = '';
  private visible = false;
  private disposed = false;
  private autoRotate = false;

  public constructor() {
    this.scene.background = new THREE.Color(0x0a1c2a);
    this.scene.add(new THREE.HemisphereLight(0xdaf4ff, 0x36546b, 2.5));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(-3, 5, -4);
    const rim = new THREE.DirectionalLight(0x40dcff, 2);
    rim.position.set(3, 2, 3);
    this.scene.add(key, rim, this.pivot);
  }

  public showCharacter(definition: CharacterDefinition, appearance: CharacterAppearance): void {
    const key = JSON.stringify(appearance);
    if (this.key === key || this.disposed) return;
    const visual = createCharacterVisual(definition, appearance);
    this.replace(key, visual.root, visual.dispose);
    this.pivot.rotation.y = -0.35;
    this.frame();
  }

  public showWeapon(definition: WeaponDefinition, skin: WeaponSkinDefinition): void {
    const key = `${definition.id}:${skin.id}`;
    if (this.key === key || this.disposed) return;
    const model = createWeaponModel(definition, skin);
    this.replace(key, model.group, () => disposeWeaponModel(model));
    this.pivot.rotation.y = -1.05;
    this.frame();
  }

  public setVisible(visible: boolean): void { this.visible = visible; }
  public get isVisible(): boolean { return this.visible && !this.disposed; }
  public setRotation(radians: number): void { this.pivot.rotation.y = radians; }
  public setAutoRotate(enabled: boolean): void { this.autoRotate = enabled; }
  public update(deltaSeconds: number): void {
    if (this.isVisible && this.autoRotate) this.pivot.rotation.y += Math.min(Math.max(deltaSeconds, 0), 0.1) * 0.3;
  }

  public resize(aspect: number): void {
    this.camera.aspect = Math.max(aspect, 0.1);
    this.frame();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.releaseModel?.();
    this.releaseModel = null;
    this.pivot.clear();
    this.scene.clear();
  }

  private replace(key: string, model: THREE.Object3D, release: () => void): void {
    this.releaseModel?.();
    this.pivot.clear();
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.add(model);
    this.releaseModel = release;
    this.key = key;
  }

  private frame(): void {
    if (this.pivot.children.length === 0) return;
    const bounds = new THREE.Box3().setFromObject(this.pivot);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const extent = Math.max(size.y, Math.max(size.x, size.z) / this.camera.aspect);
    const distance = extent / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.35;
    this.camera.position.set(center.x, center.y + 0.2, center.z - distance);
    this.camera.lookAt(center);
    this.camera.updateProjectionMatrix();
  }
}
