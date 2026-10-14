import * as THREE from 'three';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { InputManager } from '../engine/InputManager';
import type { PlayerConfig } from './PlayerConfig';
import type { SprintMode } from '../settings/SettingsService';
import { calculatePlanarWishDirection, clampHorizontalSpeed, moveTowardsVector } from './PlayerMath';
import { PlayerMovementState } from './PlayerState';

export interface PlayerMotorUpdateResult {
  landed: boolean;
  reset: boolean;
}

export class PlayerMotor {
  private readonly collisionWorld: CollisionWorld;
  private readonly config: PlayerConfig;
  private readonly position = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private readonly desiredDirection = new THREE.Vector3();
  private readonly horizontalVelocity = new THREE.Vector3();
  private readonly targetVelocity = new THREE.Vector3();
  private readonly movementVelocity = new THREE.Vector3();
  private movementState = PlayerMovementState.DISABLED;
  private grounded = false;
  private wasGrounded = false;
  private jumpBufferRemaining = 0;
  private coyoteRemaining = 0;
  private collisionCount = 0;
  private active = false;
  private sprintMode: SprintMode = 'hold';
  private sprintToggled = false;

  public constructor(collisionWorld: CollisionWorld, config: PlayerConfig) {
    this.collisionWorld = collisionWorld;
    this.config = config;
    this.position.fromArray(config.spawnPosition);
    this.collisionWorld.createPlayer({
      radius: config.movement.collisionRadius,
      standingHeight: config.movement.standingHeight,
      footPosition: config.spawnPosition,
      controllerOffset: 0.03,
      maximumWalkableSlope: config.movement.maximumWalkableSlope,
      groundSnapDistance: config.movement.groundSnapDistance,
      stepHeight: config.movement.stepHeight,
    });
  }

  public setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.velocity.set(0, 0, 0);
      this.desiredDirection.set(0, 0, 0);
      this.jumpBufferRemaining = 0;
      this.coyoteRemaining = 0;
      this.movementState = PlayerMovementState.DISABLED;
      this.sprintToggled = false;
    }
  }

  public setSprintMode(mode: SprintMode): void {
    this.sprintMode = mode;
    if (mode === 'hold') this.sprintToggled = false;
  }

  public update(deltaSeconds: number, yaw: number, input: InputManager): PlayerMotorUpdateResult {
    if (!this.active) {
      this.movementState = PlayerMovementState.DISABLED;
      return { landed: false, reset: false };
    }

    const safeDelta = Number.isFinite(deltaSeconds) && deltaSeconds > 0
      ? Math.min(deltaSeconds, 0.1)
      : 0;
    const strafeInput = (input.isActionHeld('moveRight') ? 1 : 0) - (input.isActionHeld('moveLeft') ? 1 : 0);
    const forwardInput = (input.isActionHeld('moveForward') ? 1 : 0) - (input.isActionHeld('moveBackward') ? 1 : 0);
    calculatePlanarWishDirection(strafeInput, forwardInput, yaw, this.desiredDirection);
    const hasMovementInput = this.desiredDirection.lengthSq() > 0;
    if (forwardInput <= 0) this.sprintToggled = false;
    if (this.sprintMode === 'toggle' && input.consumeActionPressed('sprint')) this.sprintToggled = !this.sprintToggled;
    const sprinting = this.sprintMode === 'toggle' ? this.sprintToggled : input.isActionHeld('sprint');
    const targetSpeed = sprinting && forwardInput > 0
      ? this.config.movement.sprintSpeed
      : this.config.movement.walkSpeed;

    if (input.consumeActionPressed('jump')) {
      this.jumpBufferRemaining = this.config.movement.jumpBufferDuration;
    } else {
      this.jumpBufferRemaining = Math.max(this.jumpBufferRemaining - safeDelta, 0);
    }
    if (this.grounded) {
      this.coyoteRemaining = this.config.movement.coyoteTimeDuration;
    } else {
      this.coyoteRemaining = Math.max(this.coyoteRemaining - safeDelta, 0);
    }

    const canJump = this.grounded || this.coyoteRemaining > 0;
    if (this.jumpBufferRemaining > 0 && canJump) {
      this.velocity.y = this.config.movement.jumpImpulse;
      this.grounded = false;
      this.coyoteRemaining = 0;
      this.jumpBufferRemaining = 0;
    } else if (!this.grounded) {
      this.velocity.y = Math.max(
        this.velocity.y - this.config.movement.gravity * safeDelta,
        -this.config.movement.maximumFallSpeed,
      );
    } else {
      this.velocity.y = 0;
    }

    this.horizontalVelocity.set(this.velocity.x, 0, this.velocity.z);
    if (hasMovementInput) {
      this.targetVelocity.copy(this.desiredDirection).multiplyScalar(targetSpeed);
      const acceleration = this.grounded
        ? this.config.movement.groundAcceleration
        : this.config.movement.airAcceleration * this.config.movement.airControl;
      moveTowardsVector(
        this.horizontalVelocity,
        this.targetVelocity,
        acceleration * safeDelta,
        this.horizontalVelocity,
      );
    } else if (this.grounded) {
      moveTowardsVector(
        this.horizontalVelocity,
        this.targetVelocity.set(0, 0, 0),
        this.config.movement.groundFriction * safeDelta,
        this.horizontalVelocity,
      );
    }
    clampHorizontalSpeed(this.horizontalVelocity, this.config.movement.sprintSpeed);
    this.velocity.x = this.horizontalVelocity.x;
    this.velocity.z = this.horizontalVelocity.z;

    const groundedBeforeMove = this.grounded;
    const verticalMovement = groundedBeforeMove && this.velocity.y <= 0
      ? -this.config.movement.groundSnapDistance
      : this.velocity.y * safeDelta;
    this.movementVelocity.set(
      this.velocity.x * safeDelta,
      verticalMovement,
      this.velocity.z * safeDelta,
    );
    const result = this.collisionWorld.movePlayer({
      x: this.movementVelocity.x,
      y: this.movementVelocity.y,
      z: this.movementVelocity.z,
    });
    this.collisionCount = result.collisionCount;
    this.wasGrounded = groundedBeforeMove;
    this.grounded = result.grounded;
    const correctedPosition = this.collisionWorld.getPlayerFootPosition(this.config.movement.standingHeight);
    this.position.set(correctedPosition.x, correctedPosition.y, correctedPosition.z);

    if (this.grounded && this.velocity.y < 0) {
      this.velocity.y = 0;
    } else if (this.movementVelocity.y > 0 && result.movement.y < this.movementVelocity.y - 0.0001) {
      this.velocity.y = 0;
    }

    const landed = !this.wasGrounded && this.grounded;
    if (this.position.y < this.config.movement.outOfBoundsY) {
      this.reset();
      return { landed: false, reset: true };
    }

    this.updateMovementState(hasMovementInput, sprinting && forwardInput > 0, landed);
    return { landed, reset: false };
  }

  public reset(position = this.config.spawnPosition): void {
    this.sprintToggled = false;
    this.collisionWorld.setActorEnabled('player', true);
    this.collisionWorld.resetPlayer(position, this.config.movement.standingHeight);
    this.position.fromArray(position);
    this.velocity.set(0, 0, 0);
    this.desiredDirection.set(0, 0, 0);
    this.horizontalVelocity.set(0, 0, 0);
    this.targetVelocity.set(0, 0, 0);
    this.movementVelocity.set(0, 0, 0);
    this.grounded = false;
    this.wasGrounded = false;
    this.jumpBufferRemaining = 0;
    this.coyoteRemaining = 0;
    this.collisionCount = 0;
    this.movementState = this.active ? PlayerMovementState.FALLING : PlayerMovementState.DISABLED;
  }

  public getPosition(output = new THREE.Vector3()): THREE.Vector3 {
    return output.copy(this.position);
  }

  public getVelocity(output = new THREE.Vector3()): THREE.Vector3 {
    return output.copy(this.velocity);
  }

  public getDesiredDirection(output = new THREE.Vector3()): THREE.Vector3 {
    return output.copy(this.desiredDirection);
  }

  public getHorizontalSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  public getMovementState(): PlayerMovementState {
    return this.movementState;
  }

  public isGrounded(): boolean {
    return this.grounded;
  }

  public getCollisionCount(): number {
    return this.collisionCount;
  }

  public isActive(): boolean {
    return this.active;
  }

  private updateMovementState(hasMovementInput: boolean, sprinting: boolean, landed: boolean): void {
    if (landed) {
      this.movementState = PlayerMovementState.LANDING;
      return;
    }
    if (!this.grounded) {
      this.movementState = this.velocity.y > 0 ? PlayerMovementState.RISING : PlayerMovementState.FALLING;
      return;
    }
    if (!hasMovementInput) {
      this.movementState = PlayerMovementState.IDLE;
    } else if (sprinting) {
      this.movementState = PlayerMovementState.SPRINTING;
    } else {
      this.movementState = PlayerMovementState.WALKING;
    }
  }
}
