import * as THREE from 'three';
import type { GameConfig } from '../app/GameConfig';
import type { InputManager } from '../engine/InputManager';
import type { CollisionWorld } from '../physics/CollisionWorld';
import { PlayerCamera } from './PlayerCamera';
import { createPlayerConfig, type PlayerConfig, type PlayerSettings } from './PlayerConfig';
import { PlayerLook } from './PlayerLook';
import { PlayerMotor } from './PlayerMotor';
import { PointerLockManager } from './PointerLockManager';
import type { PlayerMovementState, PlayerSnapshot } from './PlayerState';

export interface PlayerControllerCallbacks {
  onPointerLockChanged: (locked: boolean) => void;
  onPointerLockError: (error: Error) => void;
}

export class PlayerController {
  private readonly scene: THREE.Scene;
  private readonly input: InputManager;
  private readonly collisionWorld: CollisionWorld;
  private readonly config: PlayerConfig;
  private readonly cameraPresentation: PlayerCamera;
  private readonly look: PlayerLook;
  private readonly motor: PlayerMotor;
  private readonly pointerLock: PointerLockManager;
  private readonly position = new THREE.Vector3();
  private active = false;
  private disposed = false;
  private baseFieldOfView: number;
  private aiming = false;
  private aimFovMultiplier = 1;

  public constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    canvas: HTMLElement,
    input: InputManager,
    collisionWorld: CollisionWorld,
    callbacks: PlayerControllerCallbacks,
    config: PlayerConfig = createPlayerConfig(),
  ) {
    this.scene = scene;
    this.input = input;
    this.collisionWorld = collisionWorld;
    this.config = config;
    this.cameraPresentation = new PlayerCamera(camera, config.camera);
    this.look = new PlayerLook(input, this.cameraPresentation.root, this.cameraPresentation.pitchPivot, config.look);
    this.motor = new PlayerMotor(collisionWorld, config);
    this.pointerLock = new PointerLockManager(
      canvas,
      document,
      callbacks.onPointerLockChanged,
      callbacks.onPointerLockError,
    );
    this.scene.add(this.cameraPresentation.root);
    this.baseFieldOfView = config.look.defaultFieldOfView;
    this.cameraPresentation.root.position.fromArray(config.spawnPosition);
    this.cameraPresentation.setFieldOfView(config.look.defaultFieldOfView);
  }

  public get isPointerLocked(): boolean {
    return this.pointerLock.isLocked;
  }

  public requestPointerLock(): boolean {
    return this.pointerLock.request();
  }

  public exitPointerLock(): void {
    this.pointerLock.exit();
  }

  public setActive(active: boolean): void {
    if (this.disposed || this.active === active) {
      return;
    }
    this.active = active;
    this.motor.setActive(active);
    if (!active) {
      this.input.reset();
    }
  }

  public update(deltaSeconds: number): void {
    if (this.disposed) {
      return;
    }

    this.look.update(this.active && this.pointerLock.isLocked);
    if (!this.active || !this.pointerLock.isLocked) {
      return;
    }

    const motorResult = this.motor.update(deltaSeconds, this.look.getYaw(), this.input);
    this.motor.getPosition(this.position);
    this.cameraPresentation.root.position.copy(this.position);
    this.cameraPresentation.updatePresentation(
      deltaSeconds,
      this.motor.getHorizontalSpeed(),
      this.motor.isGrounded(),
      this.motor.getMovementState(),
      motorResult.landed,
    );
  }

  public reset(position?: readonly [number, number, number], yaw = 0): void {
    this.motor.reset(position);
    this.motor.getPosition(this.position);
    this.cameraPresentation.root.position.copy(this.position);
    this.look.reset(yaw);
    this.cameraPresentation.resetPresentation();
    this.input.reset();
  }

  public applySettings(settings: PlayerSettings): void {
    this.look.setSensitivity(settings.mouseSensitivity);
    this.look.setInvertY(settings.invertY);
    this.motor.setSprintMode(settings.sprintMode);
    this.baseFieldOfView = settings.fieldOfView;
    this.cameraPresentation.setFieldOfView(this.aiming ? settings.fieldOfView * this.aimFovMultiplier : settings.fieldOfView);
    this.config.camera.headBobEnabled = settings.headBobEnabled;
    this.config.camera.cameraEffectsEnabled = settings.cameraEffectsEnabled;
  }

  public addLookImpulse(yaw: number, pitch: number): void {
    this.look.applyImpulse(yaw, pitch);
  }

  public setAiming(aiming: boolean, fovMultiplier: number): void {
    this.aiming = aiming;
    this.aimFovMultiplier = aiming ? fovMultiplier : 1;
    this.cameraPresentation.setFieldOfView(aiming ? this.baseFieldOfView * fovMultiplier : this.baseFieldOfView);
  }

  public getSnapshot(): PlayerSnapshot {
    return {
      position: this.motor.getPosition(),
      velocity: this.motor.getVelocity(),
      desiredDirection: this.motor.getDesiredDirection(),
      horizontalSpeed: this.motor.getHorizontalSpeed(),
      grounded: this.motor.isGrounded(),
      movementState: this.motor.getMovementState() as PlayerMovementState,
      yaw: this.look.getYaw(),
      pitch: this.look.getPitch(),
      pointerLocked: this.pointerLock.isLocked,
      collisionCount: this.motor.getCollisionCount(),
    };
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.active = false;
    this.pointerLock.dispose();
    this.collisionWorld.removePlayer();
    this.scene.remove(this.cameraPresentation.root);
  }

  public getConfig(): PlayerConfig {
    return this.config;
  }

  public getRoot(): THREE.Object3D {
    return this.cameraPresentation.root;
  }
}

export function createDefaultPlayerConfig(gameConfig: GameConfig): PlayerConfig {
  const config = createPlayerConfig();
  config.look.defaultFieldOfView = gameConfig.camera.fieldOfView;
  return config;
}
