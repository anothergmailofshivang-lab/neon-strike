import * as THREE from 'three';

export function calculatePlanarWishDirection(
  strafeInput: number,
  forwardInput: number,
  yaw: number,
  output: THREE.Vector3,
): THREE.Vector3 {
  const inputLength = Math.hypot(strafeInput, forwardInput);
  if (inputLength <= Number.EPSILON) {
    return output.set(0, 0, 0);
  }

  const normalizedStrafe = strafeInput / inputLength;
  const normalizedForward = forwardInput / inputLength;
  const forwardX = Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = Math.sin(yaw);
  return output.set(
    rightX * normalizedStrafe + forwardX * normalizedForward,
    0,
    rightZ * normalizedStrafe + forwardZ * normalizedForward,
  ).normalize();
}

export function moveTowardsScalar(current: number, target: number, maximumDelta: number): number {
  if (Math.abs(target - current) <= maximumDelta) {
    return target;
  }
  return current + Math.sign(target - current) * maximumDelta;
}

export function moveTowardsVector(
  current: THREE.Vector3,
  target: THREE.Vector3,
  maximumDelta: number,
  output: THREE.Vector3,
): THREE.Vector3 {
  const deltaX = target.x - current.x;
  const deltaY = target.y - current.y;
  const deltaZ = target.z - current.z;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
  if (distance <= maximumDelta || distance <= Number.EPSILON) {
    return output.copy(target);
  }
  const factor = maximumDelta / distance;
  return output.set(
    current.x + deltaX * factor,
    current.y + deltaY * factor,
    current.z + deltaZ * factor,
  );
}

export function clampHorizontalSpeed(vector: THREE.Vector3, maximumSpeed: number): THREE.Vector3 {
  const horizontalSpeed = Math.hypot(vector.x, vector.z);
  if (horizontalSpeed > maximumSpeed && horizontalSpeed > Number.EPSILON) {
    const factor = maximumSpeed / horizontalSpeed;
    vector.x *= factor;
    vector.z *= factor;
  }
  return vector;
}
