import * as THREE from 'three';
import type { CollisionWorld } from '../physics/CollisionWorld';

export interface CoverPoint {
  id: string;
  position: THREE.Vector3;
  tags: readonly string[];
}

export class CoverRegistry {
  private readonly points: CoverPoint[] = [];

  public register(point: CoverPoint): void {
    this.points.push({ ...point, position: point.position.clone() });
  }

  public findBestCover(
    from: THREE.Vector3,
    threat: THREE.Vector3,
    collisionWorld: CollisionWorld,
  ): CoverPoint | null {
    let best: CoverPoint | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const point of this.points) {
      const distance = from.distanceTo(point.position);
      if (distance > 40) {
        continue;
      }
      const direction = threat.clone().sub(point.position);
      const threatDistance = direction.length();
      direction.normalize();
      const obstruction = collisionWorld.raycastStaticWorld(
        { x: point.position.x, y: point.position.y + 1.1, z: point.position.z },
        { x: direction.x, y: direction.y, z: direction.z },
        Math.max(threatDistance - 0.3, 0.1),
      );
      const isBlocked = obstruction !== null;
      if (!isBlocked) {
        continue;
      }
      const score = (isBlocked ? 25 : 0) - distance * 0.65 + (point.tags.includes('cover') ? 4 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = point;
      }
    }
    return best;
  }

  public getAll(): readonly CoverPoint[] {
    return this.points;
  }
}

export function createPracticeCoverRegistry(): CoverRegistry {
  const registry = new CoverRegistry();
  const points: Array<[string, [number, number, number], string[]]> = [
    ['central-west', [-6, 0, 0], ['cover']],
    ['central-east', [6, 0, 0], ['cover']],
    ['south-west', [-13, 0, -5], ['cover']],
    ['south-east', [13, 0, 5], ['cover']],
    ['north-west', [-7, 0, -10], ['cover', 'sniper']],
    ['north-east', [7, 0, -10], ['cover', 'sniper']],
  ];
  for (const [id, position, tags] of points) {
    registry.register({ id, position: new THREE.Vector3(...position), tags });
  }
  return registry;
}
