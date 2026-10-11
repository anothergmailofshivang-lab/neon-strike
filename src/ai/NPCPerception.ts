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

export class NPCPerception {
  private readonly collisionWorld: CollisionWorld;
  private readonly profile: NPCPerceptionProfile;
  private readonly toTarget = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly origin = new THREE.Vector3();

  public constructor(collisionWorld: CollisionWorld, profile: NPCPerceptionProfile) {
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
    this.forward.set(Math.sin(observerYaw), 0, -Math.cos(observerYaw));
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

  private hasLineOfSight(origin: THREE.Vector3, target: THREE.Vector3, distance: number): boolean {
    const direction = target.clone().sub(origin).normalize();
    const obstruction = this.collisionWorld.raycastStaticWorld(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: direction.x, y: direction.y, z: direction.z },
      Math.max(distance - 0.25, 0.01),
    );
    return obstruction === null;
  }
}
