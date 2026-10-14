import * as THREE from 'three';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { NPCPerceptionProfile } from './NPCDefinitions';
import type { NPCMemory } from './NPCMemory';

export interface NPCObservation {
  visible: boolean;
  distance: number;
  direction: THREE.Vector3;
  targetPosition: THREE.Vector3;
}

export type VisibilityBlocker = (origin: THREE.Vector3, target: THREE.Vector3) => boolean;

export class NPCPerception {
  private readonly collisionWorld: CollisionWorld;
  private readonly profile: NPCPerceptionProfile;
  private readonly toTarget = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly origin = new THREE.Vector3();

  public constructor(collisionWorld: CollisionWorld, profile: NPCPerceptionProfile, private readonly visibilityBlocker: VisibilityBlocker | null = null) {
    this.collisionWorld = collisionWorld;
    this.profile = profile;
  }

  public observe(
    observerPosition: THREE.Vector3,
    observerYaw: number,
    targetPosition: THREE.Vector3,
    memory: NPCMemory,
    time: number,
    memoryDuration: number,
  ): NPCObservation {
    this.toTarget.copy(targetPosition).sub(observerPosition);
    const distance = this.toTarget.length();
    this.toTarget.normalize();
    this.forward.set(-Math.sin(observerYaw), 0, -Math.cos(observerYaw));
    const inRange = distance <= this.profile.sightRange;
    const inFov = inRange && this.forward.dot(this.toTarget) >= Math.cos(this.profile.fieldOfView / 2);
    this.origin.set(observerPosition.x, observerPosition.y + 1.2, observerPosition.z);
    const target = targetPosition.clone();
    const visible = inFov && this.hasLineOfSight(this.origin, target, distance);
    if (visible) {
      memory.observeTarget(target, time);
    } else {
      memory.loseVisual(time, memoryDuration);
    }
    return { visible, distance, direction: this.toTarget.clone(), targetPosition: target };
  }

  public canSee(position: THREE.Vector3, yaw: number, target: THREE.Vector3): boolean {
    const origin = position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const direction = target.clone().sub(origin);
    const distance = direction.length();
    return distance < this.profile.sightRange
      && new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).dot(direction.normalize()) >= Math.cos(this.profile.fieldOfView / 2)
      && this.hasLineOfSight(origin, target, distance);
  }

  private hasLineOfSight(origin: THREE.Vector3, target: THREE.Vector3, distance: number): boolean {
    if (this.visibilityBlocker?.(origin, target)) return false;
    const direction = target.clone().sub(origin).normalize();
    const obstruction = this.collisionWorld.raycastStaticWorld(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: direction.x, y: direction.y, z: direction.z },
      Math.max(distance - 0.25, 0.01),
    );
    return obstruction === null;
  }
}
