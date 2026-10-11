import type * as RAPIER from '@dimforge/rapier3d-compat';

export interface StaticBoxColliderDefinition {
  name: string;
  size: readonly [number, number, number];
  position: readonly [number, number, number];
  rotation?: readonly [number, number, number];
}

export interface PlayerColliderConfig {
  radius: number;
  standingHeight: number;
  footPosition: readonly [number, number, number];
  controllerOffset: number;
  maximumWalkableSlope: number;
  groundSnapDistance: number;
  stepHeight: number;
}

export interface ActorColliderConfig extends PlayerColliderConfig {
  id: string;
}

export interface CollisionMoveResult {
  movement: RAPIER.Vector;
  grounded: boolean;
  collisionCount: number;
}

export interface WorldRaycastResult {
  distance: number;
  point: RAPIER.Vector;
  normal: RAPIER.Vector;
}

/**
 * Rapier adapter used by the player motor. Static arena bodies and the
 * kinematic player body are owned here so gameplay code does not depend on
 * low-level physics-set bookkeeping.
 */
export class CollisionWorld {
  private readonly world: RAPIER.World;
  private readonly rapier: typeof RAPIER;
  private readonly staticBodies: RAPIER.RigidBody[] = [];
  private readonly actors = new Map<string, {
    body: RAPIER.RigidBody;
    collider: RAPIER.Collider;
    controller: RAPIER.KinematicCharacterController;
  }>();
  private disposed = false;

  private constructor(rapier: typeof RAPIER, world: RAPIER.World) {
    this.rapier = rapier;
    this.world = world;
  }

  public static async create(definitions: readonly StaticBoxColliderDefinition[]): Promise<CollisionWorld> {
    const rapier = await import('@dimforge/rapier3d-compat');
    await rapier.init();
    const collisionWorld = new CollisionWorld(rapier, new rapier.World({ x: 0, y: 0, z: 0 }));
    collisionWorld.createStaticColliders(definitions);
    return collisionWorld;
  }

  public createPlayer(config: PlayerColliderConfig): void {
    this.createActor({ ...config, id: 'player' });
  }

  public createActor(config: ActorColliderConfig): void {
    if (this.actors.has(config.id) || this.disposed) {
      return;
    }

    const halfHeight = Math.max((config.standingHeight - config.radius * 2) / 2, 0.05);
    const [x, footY, z] = config.footPosition;
    const body = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(
        x,
        footY + config.standingHeight / 2,
        z,
      ),
    );
    body.lockRotations(true, true);
    const collider = this.world.createCollider(
      this.rapier.ColliderDesc.capsule(halfHeight, config.radius)
        .setFriction(0)
        .setRestitution(0),
      body,
    );
    const controller = this.world.createCharacterController(config.controllerOffset);
    controller.setUp({ x: 0, y: 1, z: 0 });
    controller.setSlideEnabled(true);
    controller.setMaxSlopeClimbAngle(config.maximumWalkableSlope);
    controller.setMinSlopeSlideAngle(Math.min(config.maximumWalkableSlope + 0.25, Math.PI * 0.49));
    controller.enableSnapToGround(config.groundSnapDistance);
    if (config.stepHeight > 0) {
      controller.enableAutostep(config.stepHeight, Math.max(config.radius * 0.5, 0.1), false);
    }

    this.actors.set(config.id, { body, collider, controller });
    this.world.updateSceneQueries();
  }

  public movePlayer(desiredMovement: RAPIER.Vector): CollisionMoveResult {
    return this.moveActor('player', desiredMovement);
  }

  public moveActor(actorId: string, desiredMovement: RAPIER.Vector): CollisionMoveResult {
    const actor = this.actors.get(actorId);
    if (!actor || this.disposed) {
      return { movement: { x: 0, y: 0, z: 0 }, grounded: false, collisionCount: 0 };
    }

    this.world.updateSceneQueries();
    actor.controller.computeColliderMovement(actor.collider, desiredMovement);
    const movement = actor.controller.computedMovement();
    const current = actor.body.translation();
    actor.body.setTranslation({
      x: current.x + movement.x,
      y: current.y + movement.y,
      z: current.z + movement.z,
    }, true);
    this.world.propagateModifiedBodyPositionsToColliders();
    this.world.updateSceneQueries();

    return { movement, grounded: actor.controller.computedGrounded(), collisionCount: actor.controller.numComputedCollisions() };
  }

  public getPlayerFootPosition(standingHeight: number): RAPIER.Vector {
    return this.getActorFootPosition('player', standingHeight);
  }

  public getActorFootPosition(actorId: string, standingHeight: number): RAPIER.Vector {
    const translation = this.actors.get(actorId)?.body.translation() ?? { x: 0, y: standingHeight / 2, z: 0 };
    return {
      x: translation.x,
      y: translation.y - standingHeight / 2,
      z: translation.z,
    };
  }

  public resetPlayer(footPosition: readonly [number, number, number], standingHeight: number): void {
    this.resetActor('player', footPosition, standingHeight);
  }

  public resetActor(actorId: string, footPosition: readonly [number, number, number], standingHeight: number): void {
    const actor = this.actors.get(actorId);
    if (!actor || this.disposed) {
      return;
    }

    actor.body.setTranslation({
      x: footPosition[0],
      y: footPosition[1] + standingHeight / 2,
      z: footPosition[2],
    }, true);
    actor.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.world.propagateModifiedBodyPositionsToColliders();
    this.world.updateSceneQueries();
  }

  public getPlayerCollider(): RAPIER.Collider | null {
    return this.actors.get('player')?.collider ?? null;
  }

  public getActorCollider(actorId: string): RAPIER.Collider | null {
    return this.actors.get(actorId)?.collider ?? null;
  }

  public setActorEnabled(id: string, enabled: boolean): void {
    this.actors.get(id)?.collider.setEnabled(enabled);
    this.world.updateSceneQueries();
  }

  /** Static capsule clearance, shared by navigation and spawn validation. */
  public isCapsuleClear(position: { x: number; y: number; z: number }, radius = 0.58, height = 2.25): boolean {
    this.world.updateSceneQueries();
    return this.world.intersectionWithShape(
      { x: position.x, y: position.y + height / 2 + 0.05, z: position.z },
      { x: 0, y: 0, z: 0, w: 1 },
      new this.rapier.Capsule(height / 2 - radius, radius),
      undefined, undefined, undefined, undefined,
      (collider) => collider.parent()?.isFixed() ?? true,
    ) === null;
  }

  public replaceStaticColliders(definitions: readonly StaticBoxColliderDefinition[]): void {
    if (this.disposed) {
      return;
    }
    this.removeStaticColliders();
    this.createStaticColliders(definitions);
    this.world.propagateModifiedBodyPositionsToColliders();
    this.world.updateSceneQueries();
  }

  public raycastWorld(
    origin: RAPIER.Vector,
    direction: RAPIER.Vector,
    maximumDistance: number,
    excludeActorId = 'player',
  ): WorldRaycastResult | null {
    if (this.disposed || !Number.isFinite(maximumDistance) || maximumDistance <= 0) {
      return null;
    }

    return this.castRay(origin, direction, maximumDistance, this.actors.get(excludeActorId)?.collider);
  }

  public raycastStaticWorld(
    origin: RAPIER.Vector,
    direction: RAPIER.Vector,
    maximumDistance: number,
  ): WorldRaycastResult | null {
    if (this.disposed || !Number.isFinite(maximumDistance) || maximumDistance <= 0) {
      return null;
    }
    return this.castRay(origin, direction, maximumDistance, undefined, undefined, (collider) => collider.parent()?.isFixed() ?? true);
  }

  private castRay(
    origin: RAPIER.Vector,
    direction: RAPIER.Vector,
    maximumDistance: number,
    excludeCollider?: RAPIER.Collider,
    filterFlags?: RAPIER.QueryFilterFlags,
    filterPredicate?: (collider: RAPIER.Collider) => boolean,
  ): WorldRaycastResult | null {
    this.world.updateSceneQueries();
    const ray = new this.rapier.Ray(origin, direction);
    const hit = this.world.castRayAndGetNormal(
      ray,
      maximumDistance,
      true,
      filterFlags,
      undefined,
      excludeCollider,
      undefined,
      filterPredicate,
    );
    if (!hit) {
      return null;
    }
    return {
      distance: hit.toi,
      point: ray.pointAt(hit.toi),
      normal: hit.normal,
    };
  }

  public removePlayer(): void {
    this.removeActor('player');
  }

  public removeActor(actorId: string): void {
    const actor = this.actors.get(actorId);
    if (!actor || this.disposed) {
      return;
    }

    this.world.removeCharacterController(actor.controller);
    this.world.removeRigidBody(actor.body);
    this.actors.delete(actorId);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    for (const actorId of this.actors.keys()) {
      this.removeActor(actorId);
    }
    this.disposed = true;
    this.staticBodies.length = 0;
    this.world.free();
  }

  private createStaticColliders(definitions: readonly StaticBoxColliderDefinition[]): void {
    for (const definition of definitions) {
      const bodyDescription = this.rapier.RigidBodyDesc.fixed().setTranslation(...definition.position);
      if (definition.rotation) {
        const [x, y, z] = definition.rotation;
        bodyDescription.setRotation(quaternionFromEuler(x, y, z));
      }
      const body = this.world.createRigidBody(bodyDescription);
      const collider = this.rapier.ColliderDesc.cuboid(
        definition.size[0] / 2,
        definition.size[1] / 2,
        definition.size[2] / 2,
      )
        .setFriction(0)
        .setRestitution(0);
      this.world.createCollider(collider, body);
      body.userData = { name: definition.name };
      this.staticBodies.push(body);
    }
  }

  private removeStaticColliders(): void {
    for (const body of this.staticBodies) {
      this.world.removeRigidBody(body);
    }
    this.staticBodies.length = 0;
  }
}

function quaternionFromEuler(x: number, y: number, z: number): RAPIER.Rotation {
  const cx = Math.cos(x / 2);
  const sx = Math.sin(x / 2);
  const cy = Math.cos(y / 2);
  const sy = Math.sin(y / 2);
  const cz = Math.cos(z / 2);
  const sz = Math.sin(z / 2);
  return {
    x: sx * cy * cz - cx * sy * sz,
    y: cx * sy * cz + sx * cy * sz,
    z: cx * cy * sz - sx * sy * cz,
    w: cx * cy * cz + sx * sy * sz,
  };
}
