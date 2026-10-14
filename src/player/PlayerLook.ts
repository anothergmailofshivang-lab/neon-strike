import * as THREE from 'three';
import type { InputManager } from '../engine/InputManager';
import type { PlayerLookConfig } from './PlayerConfig';

export class PlayerLook {
  private readonly input: InputManager;
  private readonly yawObject: THREE.Object3D;
  private readonly pitchObject: THREE.Object3D;
  private readonly config: PlayerLookConfig;
  private yaw = 0;
  private pitch = 0;
  private invertY = false;

  public constructor(
    input: InputManager,
    yawObject: THREE.Object3D,
    pitchObject: THREE.Object3D,
    config: PlayerLookConfig,
  ) {
    this.input = input;
    this.yawObject = yawObject;
    this.pitchObject = pitchObject;
    this.config = config;
    this.applyRotation();
  }

  public update(active: boolean): void {
    const delta = this.input.consumeMouseDelta();
    if (!active) {
      return;
    }

    this.yaw -= delta.x * this.config.mouseSensitivity;
    this.pitch += (this.invertY ? 1 : -1) * delta.y * this.config.mouseSensitivity * this.config.verticalSensitivityMultiplier;
    this.pitch = Math.min(Math.max(this.pitch, this.config.minimumPitch), this.config.maximumPitch);
    this.applyRotation();
  }

  public reset(yaw = 0, pitch = 0): void {
    this.yaw = yaw;
    this.pitch = Math.min(Math.max(pitch, this.config.minimumPitch), this.config.maximumPitch);
    this.applyRotation();
  }

  public setSensitivity(sensitivity: number): void {
    if (Number.isFinite(sensitivity) && sensitivity > 0) {
      this.config.mouseSensitivity = sensitivity;
    }
  }

  public setInvertY(invertY: boolean): void {
    this.invertY = invertY;
  }

  public getYaw(): number {
    return this.yaw;
  }

  public getPitch(): number {
    return this.pitch;
  }

  public applyImpulse(yaw: number, pitch: number): void {
    this.yaw += Number.isFinite(yaw) ? yaw : 0;
    this.pitch += Number.isFinite(pitch) ? pitch : 0;
    this.pitch = Math.min(Math.max(this.pitch, this.config.minimumPitch), this.config.maximumPitch);
    this.applyRotation();
  }

  private applyRotation(): void {
    this.yawObject.rotation.set(0, this.yaw, 0);
    this.pitchObject.rotation.set(this.pitch, 0, 0);
  }
}
