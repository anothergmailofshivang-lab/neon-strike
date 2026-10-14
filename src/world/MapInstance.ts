import type * as THREE from 'three';
import type { StaticBoxColliderDefinition } from '../physics/CollisionWorld';
import type { NavigationGraph } from '../navigation/NavigationGraph';
import type { CoverRegistry } from './CoverRegistry';
import { MapLifecycleState, type MapBuildOutput, type MapControlPointDefinition, type MapDefinition, type MapPickupDefinition, type MapSpawnPoint, type MapTrainingTargetDefinition } from './MapDefinition';

export class MapInstance {
  public readonly definition: MapDefinition;
  public readonly root: THREE.Group;
  public readonly collisionDefinitions: readonly StaticBoxColliderDefinition[];
  public navigationGraph: NavigationGraph;
  public readonly coverRegistry: CoverRegistry;
  public readonly playerSpawns: readonly MapSpawnPoint[];
  public readonly npcSpawns: readonly MapSpawnPoint[];
  public readonly pickups: readonly MapPickupDefinition[];
  public readonly trainingTargets: readonly MapTrainingTargetDefinition[];
  public readonly controlPoints: readonly MapControlPointDefinition[];
  public readonly interactions: MapDefinition['interactions'];
  public readonly destructibles: MapDefinition['destructibles'];
  private readonly releaseResources: () => void;
  private disposed = false;
  private lifecycleState: MapLifecycleState;

  public constructor(definition: MapDefinition, output: MapBuildOutput) {
    this.definition = definition;
    this.root = output.root;
    this.collisionDefinitions = output.collisionDefinitions;
    this.navigationGraph = output.navigationGraph;
    this.coverRegistry = output.coverRegistry;
    this.playerSpawns = output.playerSpawns;
    this.npcSpawns = output.npcSpawns;
    this.pickups = output.pickups;
    this.trainingTargets = output.trainingTargets;
    this.controlPoints = definition.controlPoints;
    this.interactions = definition.interactions ?? [];
    this.destructibles = definition.destructibles ?? [];
    this.releaseResources = output.dispose;
    this.lifecycleState = MapLifecycleState.READY;
  }

  public get state(): MapLifecycleState {
    return this.lifecycleState;
  }

  public setState(state: MapLifecycleState): void {
    this.lifecycleState = state;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.lifecycleState = MapLifecycleState.DISPOSING;
    this.releaseResources();
    this.lifecycleState = MapLifecycleState.UNLOADED;
  }
}
