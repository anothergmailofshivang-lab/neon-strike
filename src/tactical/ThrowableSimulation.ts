import * as THREE from 'three';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { EquipmentDefinition } from '../equipment/EquipmentTypes';

export const THROW_SPEED = 13;
export const THROW_GRAVITY = 9.81;
export const THROW_RADIUS = 0.13;
const STEP = 1 / 120;

/** No timers or frame loop: fed by the existing fixed-step simulation. */
export class ThrowableSimulation {
  public readonly position: THREE.Vector3;
  public readonly velocity: THREE.Vector3;
  public age = 0;
  public finished = false;
  private accumulator = 0;

  public constructor(position: THREE.Vector3, velocity: THREE.Vector3, public readonly definition: EquipmentDefinition) {
    this.position = position.clone();
    this.velocity = velocity.clone();
  }

  public update(seconds: number, world: Pick<CollisionWorld, 'sweepSphere'>): 'flying' | 'detonate' | 'expired' {
    if (this.finished) return 'expired';
    this.accumulator += Number.isFinite(seconds) ? Math.min(Math.max(seconds, 0), 0.25) : 0;
    while (this.accumulator + 1e-9 >= STEP) {
      this.accumulator -= STEP;
      this.age += STEP;
      this.velocity.y -= (this.definition.gravity ?? THROW_GRAVITY) * STEP;
      const movement = this.velocity.clone().multiplyScalar(STEP);
      const distance = movement.length();
      const hit = distance > 0 ? world.sweepSphere(this.position, movement.clone().normalize(), distance, THROW_RADIUS) : null;
      if (hit) {
        const normal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z).normalize();
        this.position.copy(hit.point).addScaledVector(normal, 0.003);
        if (this.velocity.dot(normal) < 0) this.velocity.reflect(normal).multiplyScalar(this.definition.bounceDamping);
        if (normal.y > 0.7 && this.velocity.length() < 0.3) this.velocity.set(0, 0, 0);
      } else this.position.add(movement);
      if (this.position.y < -15 || this.position.length() > 300) {
        this.finished = true;
        return 'expired';
      }
      if (this.age + 1e-9 >= this.definition.fuseSeconds) {
        this.finished = true;
        return 'detonate';
      }
      if (this.age >= this.definition.lifetimeSeconds) { this.finished = true; return 'expired'; }
    }
    return 'flying';
  }
}

export function validThrowVector(value: THREE.Vector3): boolean {
  return [value.x, value.y, value.z].every(Number.isFinite);
}

export function releasePosition(world: Pick<CollisionWorld, 'sweepSphere' | 'isSphereClear'>, origin: THREE.Vector3, direction: THREE.Vector3): THREE.Vector3 | null {
  if (!validThrowVector(origin) || !validThrowVector(direction) || direction.lengthSq() < 0.01 || !world.isSphereClear(origin, THROW_RADIUS)) return null;
  const unit = direction.clone().normalize();
  if (world.sweepSphere(origin, unit, 0.65, THROW_RADIUS)) return null;
  return origin.clone().addScaledVector(unit, 0.65);
}
