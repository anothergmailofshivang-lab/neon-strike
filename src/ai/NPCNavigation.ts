import * as THREE from 'three';
import { AStarPathfinder, type NavigationPath } from '../navigation/AStarPathfinder';
import { NavigationGraph } from '../navigation/NavigationGraph';

export class NPCNavigation {
  private readonly graph: NavigationGraph;
  private readonly pathfinder = new AStarPathfinder();
  private path: NavigationPath | null = null;
  private nextIndex = 0;
  private lastGoal = '';
  private queryCount = 0;

  public constructor(graph: NavigationGraph) {
    this.graph = graph;
  }

  public requestPath(start: THREE.Vector3, goal: THREE.Vector3): boolean {
    const startNode = this.graph.findNearest(start);
    const goalNode = this.graph.findNearest(goal);
    if (!startNode || !goalNode) {
      this.path = null;
      return false;
    }
    const goalKey = goalNode.id;
    if (this.path && this.lastGoal === goalKey) {
      return true;
    }
    this.queryCount += 1;
    this.path = this.pathfinder.findPath(this.graph, startNode.id, goalNode.id);
    this.lastGoal = goalKey;
    this.nextIndex = 0;
    return this.path !== null;
  }

  public getNextWaypoint(current: THREE.Vector3, arrivalDistance = 0.35): THREE.Vector3 | null {
    if (!this.path) {
      return null;
    }
    while (this.nextIndex < this.path.nodeIds.length) {
      const node = this.graph.getNode(this.path.nodeIds[this.nextIndex]);
      if (!node) {
        this.path = null;
        return null;
      }
      if (current.distanceTo(node.position) <= arrivalDistance) {
        this.nextIndex += 1;
        continue;
      }
      return node.position.clone();
    }
    return null;
  }

  public clear(): void {
    this.path = null;
    this.nextIndex = 0;
    this.lastGoal = '';
  }

  public get isComplete(): boolean {
    return this.path !== null && this.nextIndex >= this.path.nodeIds.length;
  }

  public get route(): readonly string[] {
    return this.path?.nodeIds ?? [];
  }

  public get pathQueries(): number {
    return this.queryCount;
  }
}
