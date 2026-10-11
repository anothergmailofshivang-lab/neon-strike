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

  it('keeps forward/backward and strafe directions aligned with the player root yaw', () => {
    const angles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, 5 * Math.PI / 4, 3 * Math.PI / 2, 7 * Math.PI / 4];
    for (const yaw of angles) {
      const forward = calculatePlanarWishDirection(0, 1, yaw, new THREE.Vector3());
      const backward = calculatePlanarWishDirection(0, -1, yaw, new THREE.Vector3());
      const left = calculatePlanarWishDirection(-1, 0, yaw, new THREE.Vector3());
      const right = calculatePlanarWishDirection(1, 0, yaw, new THREE.Vector3());
      const expectedForward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const expectedRight = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

      expect(forward.dot(expectedForward)).toBeCloseTo(1);
      expect(backward.dot(expectedForward)).toBeCloseTo(-1);
      expect(right.dot(expectedRight)).toBeCloseTo(1);
      expect(left.dot(expectedRight)).toBeCloseTo(-1);
      expect(forward.dot(right)).toBeCloseTo(0);
    }
  });

  it('cancels opposing axes and normalizes diagonal movement', () => {
    for (const yaw of [0, Math.PI / 3, Math.PI, 5 * Math.PI / 3]) {
      expect(calculatePlanarWishDirection(0, 0, yaw, new THREE.Vector3()).length()).toBe(0);
      expect(calculatePlanarWishDirection(1, -1, yaw, new THREE.Vector3()).length()).toBeCloseTo(1);
      expect(calculatePlanarWishDirection(1, 1, yaw, new THREE.Vector3()).length()).toBeCloseTo(1);
    }
  });
});
