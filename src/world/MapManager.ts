import * as THREE from 'three';
import type { CollisionWorld } from '../physics/CollisionWorld';
import { MapInstance } from './MapInstance';
import { MapLifecycleState, type MapDefinition } from './MapDefinition';
import { MapRegistry } from './MapRegistry';
import { validateMapInstance, validateMapSpawns, type MapValidationResult } from './MapValidation';
import { buildWalkableNavigation } from '../navigation/WalkableNavigation';

export class MapManager {
  private readonly scene: THREE.Scene;
  private readonly collisionWorld: CollisionWorld;
  private readonly registry: MapRegistry;
  private activeMap: MapInstance | null = null;
  private lifecycleState = MapLifecycleState.UNLOADED;
  private lastValidation: MapValidationResult | null = null;
  private transitionInProgress = false;

  public constructor(scene: THREE.Scene, collisionWorld: CollisionWorld, registry: MapRegistry) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.registry = registry;
  }

  public get current(): MapInstance | null {
    return this.activeMap;
  }

  public get state(): MapLifecycleState {
    return this.lifecycleState;
  }

  public get validation(): MapValidationResult | null {
    return this.lastValidation;
  }

  public get maps(): readonly MapDefinition[] {
    return this.registry.list();
  }

  public load(mapId: string): MapInstance {
    if (this.transitionInProgress) {
      throw new Error('A map transition is already in progress.');
    }
    const definition = this.registry.get(mapId);
    if (this.activeMap?.definition.id === mapId) {
      this.activeMap.setState(MapLifecycleState.ACTIVE);
      this.lifecycleState = MapLifecycleState.ACTIVE;
      return this.activeMap;
    }

    this.transitionInProgress = true;
    const oldMap = this.activeMap;
    const oldCollisionDefinitions = oldMap?.collisionDefinitions ?? [];
    let nextMap: MapInstance | null = null;
    try {
      this.lifecycleState = MapLifecycleState.BUILDING;
      nextMap = new MapInstance(definition, definition.build());
      this.lifecycleState = MapLifecycleState.REGISTERING_SYSTEMS;
      this.lastValidation = validateMapInstance(definition, nextMap);
      if (!this.lastValidation.valid) {
        throw new Error(`Map ${mapId} failed structural validation: ${this.lastValidation.errors.join('; ')}`);
      }
      this.collisionWorld.replaceStaticColliders(nextMap.collisionDefinitions);
      nextMap.navigationGraph = buildWalkableNavigation(nextMap, this.collisionWorld);
      this.lifecycleState = MapLifecycleState.VALIDATING;
      this.lastValidation = validateMapSpawns(nextMap, this.collisionWorld);
      if (!this.lastValidation.valid) {
        throw new Error(`Map ${mapId} failed validation: ${this.lastValidation.errors.join('; ')}`);
      }
      nextMap.setState(MapLifecycleState.READY);

      this.lifecycleState = MapLifecycleState.DEACTIVATING;
      if (oldMap) {
        this.scene.remove(oldMap.root);
        oldMap.dispose();
      }
      this.scene.add(nextMap.root);
      this.applyEnvironment(definition);
      nextMap.setState(MapLifecycleState.ACTIVE);
      this.activeMap = nextMap;
      this.lifecycleState = MapLifecycleState.ACTIVE;
      return nextMap;
    } catch (error) {
      this.lifecycleState = MapLifecycleState.FAILED;
      if (nextMap) {
        nextMap.dispose();
      }
      this.collisionWorld.replaceStaticColliders(oldCollisionDefinitions);
      throw error;
    } finally {
      this.transitionInProgress = false;
    }
  }

  public unload(): void {
    if (this.transitionInProgress) {
      throw new Error('A map transition is already in progress.');
    }
    this.transitionInProgress = true;
    try {
      this.lifecycleState = MapLifecycleState.DEACTIVATING;
      if (this.activeMap) {
        this.scene.remove(this.activeMap.root);
        this.activeMap.dispose();
        this.activeMap = null;
      }
      this.collisionWorld.replaceStaticColliders([]);
      this.lifecycleState = MapLifecycleState.UNLOADED;
    } finally {
      this.transitionInProgress = false;
    }
  }

  public dispose(): void {
    this.unload();
  }

  private applyEnvironment(definition: MapDefinition): void {
    this.scene.background = new THREE.Color(definition.lighting.backgroundColor);
    const fog = definition.lighting.fog;
    this.scene.fog = fog ? new THREE.Fog(fog.color, fog.near, fog.far) : null;
  }
}
