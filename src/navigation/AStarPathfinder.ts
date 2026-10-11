import { NavigationGraph, type NavigationNode } from './NavigationGraph';

export interface NavigationPath {
  nodeIds: readonly string[];
  cost: number;
}

export class AStarPathfinder {
  public findPath(graph: NavigationGraph, startId: string, goalId: string): NavigationPath | null {
    if (!graph.getNode(startId) || !graph.getNode(goalId)) {
      return null;
    }
    if (startId === goalId) {
      return { nodeIds: [startId], cost: 0 };
    }

    const open = new Set<string>([startId]);
    const cameFrom = new Map<string, string>();
    const costSoFar = new Map<string, number>([[startId, 0]]);
    const estimate = new Map<string, number>([[startId, this.heuristic(graph.getNode(startId)!, graph.getNode(goalId)!)]])
      ;

    while (open.size > 0) {
      const current = this.lowestEstimate(open, estimate);
      if (current === goalId) {
        return this.reconstruct(cameFrom, current, costSoFar.get(current) ?? 0);
      }
      open.delete(current);
      for (const edge of graph.getNeighbors(current)) {
        const newCost = (costSoFar.get(current) ?? Number.POSITIVE_INFINITY) + edge.cost;
        if (newCost < (costSoFar.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
          cameFrom.set(edge.to, current);
          costSoFar.set(edge.to, newCost);
          const node = graph.getNode(edge.to);
          const goal = graph.getNode(goalId);
          if (node && goal) {
            estimate.set(edge.to, newCost + this.heuristic(node, goal));
          }
          open.add(edge.to);
        }
      }
    }
    return null;
  }

  private lowestEstimate(open: Set<string>, estimate: Map<string, number>): string {
    let selected = '';
    let selectedScore = Number.POSITIVE_INFINITY;
    for (const id of open) {
      const score = estimate.get(id) ?? Number.POSITIVE_INFINITY;
      if (score < selectedScore) {
        selected = id;
        selectedScore = score;
      }
    }
    return selected;
  }

  private heuristic(a: NavigationNode, b: NavigationNode): number {
    return a.position.distanceTo(b.position);
  }

  private reconstruct(cameFrom: Map<string, string>, current: string, cost: number): NavigationPath {
    const path = [current];
    let cursor = current;
    while (cameFrom.has(cursor)) {
      cursor = cameFrom.get(cursor) as string;
      path.unshift(cursor);
    }
    return { nodeIds: path, cost };
  }
}
