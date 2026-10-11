import * as THREE from 'three';
import type { GameConfig } from '../app/GameConfig';

export class SceneManager {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public constructor(config: GameConfig) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(config.renderer.backgroundColor);
    this.camera = new THREE.PerspectiveCamera(
      config.camera.fieldOfView,
      1,
      config.camera.nearPlane,
      config.camera.farPlane,
    );
    this.camera.position.set(0, 16, 25);
    this.camera.lookAt(0, 2, 0);
  }

  public dispose(): void {
    this.scene.clear();
  }
}
