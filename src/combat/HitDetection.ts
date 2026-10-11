import * as THREE from 'three';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { Damageable } from './Damageable';
import type { HitRegion } from './DamageTypes';

export interface RegisteredHitRegion {
  object: THREE.Object3D;
  target: Damageable;
  region: HitRegion;
  damageMultiplier: number;
}

export interface ShotHit {
  kind: 'target' | 'world' | 'none';
  target: Damageable | null;
  region: HitRegion | null;
  regionMultiplier: number;
  distance: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
}

export class CombatTargetRegistry {
  private readonly regions: RegisteredHitRegion[] = [];

  public register(target: Damageable): void {
    for (const region of target.getHitRegions()) {
      this.regions.push({
        object: region.object,
        target,
        region: region.region,
        damageMultiplier: region.damageMultiplier,
      });
    }
  }

  public unregister(targetId: string): void {
    for (let index = this.regions.length - 1; index >= 0; index -= 1) {
      if (this.regions[index].target.entityId === targetId) {
        this.regions.splice(index, 1);
      }
    }
  }

  public get regionsForRaycast(): readonly RegisteredHitRegion[] {
    return this.regions;
  }

  public reset(): void {
    this.regions.length = 0;
  }
}

export class HitDetection {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly collisionWorld: CollisionWorld;
  private readonly targets: CombatTargetRegistry;
  private readonly raycaster = new THREE.Raycaster();
  private readonly origin = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly targetMeshes: THREE.Object3D[] = [];

  public constructor(
    camera: THREE.PerspectiveCamera,
    collisionWorld: CollisionWorld,
    targets: CombatTargetRegistry,
  ) {
    this.camera = camera;
    this.collisionWorld = collisionWorld;
    this.targets = targets;
  }

  public resolveCenterShot(directionOverride: THREE.Vector3 | null, range: number): ShotHit {
    this.camera.getWorldPosition(this.origin);
    if (directionOverride) {
      this.direction.copy(directionOverride).normalize();
    } else {
      this.camera.getWorldDirection(this.direction);
    }
    return this.resolve(this.origin, this.direction, range);
  }

  public resolve(origin: THREE.Vector3, direction: THREE.Vector3, range: number): ShotHit {
    this.targetMeshes.length = 0;
    for (const region of this.targets.regionsForRaycast) {
      if (region.target.isDefeated) {
        continue;
      }
      this.targetMeshes.push(region.object);
    }

    this.raycaster.set(origin, direction);
    this.raycaster.far = range;
    const intersections = this.raycaster.intersectObjects(this.targetMeshes, true);
    const targetHit = intersections[0] ?? null;
    const worldHit = this.collisionWorld.raycastStaticWorld(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: direction.x, y: direction.y, z: direction.z },
      range,
    );
    const worldDistance = worldHit?.distance ?? Number.POSITIVE_INFINITY;
    if (targetHit && targetHit.distance <= worldDistance + 0.0001) {
      const binding = this.findBinding(targetHit.object);
      if (binding) {
        const normal = targetHit.normal?.clone() ?? direction.clone().multiplyScalar(-1);
        return {
          kind: 'target',
          target: binding.target,
          region: binding.region,
          regionMultiplier: binding.damageMultiplier,
          distance: targetHit.distance,
          point: targetHit.point.clone(),
          normal,
        };
      }
    }

    if (worldHit) {
      return {
        kind: 'world',
        target: null,
        region: null,
        regionMultiplier: 1,
        distance: worldHit.distance,
        point: new THREE.Vector3(worldHit.point.x, worldHit.point.y, worldHit.point.z),
        normal: new THREE.Vector3(worldHit.normal.x, worldHit.normal.y, worldHit.normal.z),
      };
    }

    return {
      kind: 'none',
      target: null,
      region: null,
      regionMultiplier: 1,
      distance: range,
      point: origin.clone().addScaledVector(direction, range),
      normal: direction.clone().multiplyScalar(-1),
    };
  }

  private findBinding(object: THREE.Object3D): RegisteredHitRegion | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      const binding = this.targets.regionsForRaycast.find((candidate) => candidate.object === current);
      if (binding) {
        return binding;
      }
      current = current.parent;
    }
    return null;
  }
}
