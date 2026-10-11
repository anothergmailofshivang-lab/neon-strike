import * as THREE from 'three';

export enum PlayerMovementState {
  DISABLED = 'DISABLED',
  IDLE = 'IDLE',
  WALKING = 'WALKING',
  SPRINTING = 'SPRINTING',
  RISING = 'RISING',
  FALLING = 'FALLING',
  LANDING = 'LANDING',
}

export interface PlayerSnapshot {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  desiredDirection: THREE.Vector3;
  horizontalSpeed: number;
  grounded: boolean;
  movementState: PlayerMovementState;
  yaw: number;
  pitch: number;
  pointerLocked: boolean;
  collisionCount: number;
}
