import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { calculatePlanarWishDirection, moveTowardsVector } from '../src/player/PlayerMath';

describe('PlayerMath', () => {
  it('normalizes diagonal input and keeps movement planar', () => {
    const direction = calculatePlanarWishDirection(1, 1, 0, new THREE.Vector3());
    expect(direction.length()).toBeCloseTo(1);
    expect(direction.y).toBe(0);
    expect(direction.x).toBeGreaterThan(0);
    expect(direction.z).toBeLessThan(0);
  });

  it('supports in-place vector acceleration without overshooting', () => {
    const velocity = new THREE.Vector3(0, 0, 0);
    moveTowardsVector(velocity, new THREE.Vector3(10, 0, 0), 2, velocity);
    expect(velocity.x).toBeCloseTo(2);
    moveTowardsVector(velocity, new THREE.Vector3(10, 0, 0), 20, velocity);
    expect(velocity.x).toBeCloseTo(10);
  });
});
