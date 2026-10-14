import * as THREE from 'three';
import type { PlayerCameraConfig } from './PlayerConfig';
import { PlayerMovementState } from './PlayerState';

export class PlayerCamera {
  public readonly root = new THREE.Group();
  public readonly pitchPivot = new THREE.Group();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly config: PlayerCameraConfig;
  private bobTime = 0;
  private landingOffset = 0;

  public constructor(camera: THREE.PerspectiveCamera, config: PlayerCameraConfig) {
    this.camera = camera;
    this.config = config;
    this.root.name = 'PlayerRoot';
    this.pitchPivot.name = 'CameraPivot';
    this.pitchPivot.position.y = config.eyeHeight;
    this.root.add(this.pitchPivot);
    this.pitchPivot.add(camera);
    camera.position.set(0, 0, 0);
    camera.rotation.set(0, 0, 0);
  }

  public updatePresentation(
    deltaSeconds: number,
    horizontalSpeed: number,
    grounded: boolean,
    movementState: PlayerMovementState,
    landed: boolean,
  ): void {
    if (landed && this.config.cameraEffectsEnabled && this.config.landingEffectEnabled) {
      this.landingOffset = Math.min(this.landingOffset + 0.045, 0.07);
    }

    const effectsEnabled = this.config.cameraEffectsEnabled;
    if (!effectsEnabled) this.landingOffset = 0;
    const movingOnGround = grounded
      && horizontalSpeed > 0.25
      && movementState !== PlayerMovementState.DISABLED;
    let targetX = 0;
    let targetY = 0;
    if (effectsEnabled && this.config.headBobEnabled && movingOnGround) {
      const sprintScale = movementState === PlayerMovementState.SPRINTING ? 1.2 : 1;
      this.bobTime += deltaSeconds * this.config.headBobFrequency * sprintScale;
      const speedScale = Math.min(horizontalSpeed / 8, 1.35);
      targetX = Math.cos(this.bobTime * 0.5) * this.config.headBobAmplitude * speedScale;
      targetY = Math.abs(Math.sin(this.bobTime)) * this.config.headBobAmplitude * speedScale;
    } else {
      this.bobTime = 0;
    }

    const landingDecay = Math.min(deltaSeconds * 0.25, this.landingOffset);
    this.landingOffset -= landingDecay;
    this.camera.position.x = targetX;
    this.camera.position.y = targetY - this.landingOffset;
  }

  public setFieldOfView(fieldOfView: number): void {
    if (!Number.isFinite(fieldOfView)) {
      return;
    }
    this.camera.fov = fieldOfView;
    this.camera.updateProjectionMatrix();
  }

  public resetPresentation(): void {
    this.bobTime = 0;
    this.landingOffset = 0;
    this.camera.position.set(0, 0, 0);
  }
}
