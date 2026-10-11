import * as THREE from 'three';

export interface NavigationNode {
  id: string;
  position: THREE.Vector3;
  tags: readonly string[];
}

export interface NavigationEdge {
  from: string;
  to: string;
  cost: number;
}

export class NavigationGraph {
  private readonly nodes = new Map<string, NavigationNode>();
  private readonly edges = new Map<string, NavigationEdge[]>();

  public addNode(node: NavigationNode): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`Duplicate navigation node: ${node.id}`);
    }
    this.nodes.set(node.id, { ...node, position: node.position.clone() });
    this.edges.set(node.id, []);
  }

  public addBidirectionalEdge(from: string, to: string, cost?: number): void {
    const fromNode = this.nodes.get(from);
    const toNode = this.nodes.get(to);
    if (!fromNode || !toNode) {
      throw new Error(`Cannot connect missing navigation nodes: ${from} -> ${to}`);
    }
    const resolvedCost = cost ?? fromNode.position.distanceTo(toNode.position);
    this.edges.get(from)?.push({ from, to, cost: resolvedCost });
    this.edges.get(to)?.push({ from: to, to: from, cost: resolvedCost });
  }

  public getNode(id: string): NavigationNode | null {
    return this.nodes.get(id) ?? null;
  }

  public getNeighbors(id: string): readonly NavigationEdge[] {
    return this.edges.get(id) ?? [];
  }

  public findNearest(position: THREE.Vector3, requiredTag?: string): NavigationNode | null {
    let best: NavigationNode | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const node of this.nodes.values()) {
      if (requiredTag && !node.tags.includes(requiredTag)) {
        continue;
      }
      const distance = node.position.distanceToSquared(position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = node;
      }
    }
    return best;
  }

  public getAllNodes(): readonly NavigationNode[] {
    return [...this.nodes.values()];
  }
}

export function createPracticeNavigationGraph(): NavigationGraph {
  const graph = new NavigationGraph();
  const nodes: Array<[string, [number, number, number], string[]]> = [
    ['south-center', [0, 0, 14], ['spawn', 'lane']],
    ['south-west', [-12, 0, 13], ['lane', 'cover']],
    ['south-east', [12, 0, 13], ['lane', 'cover']],
    ['west-mid', [-12, 0, 4], ['lane', 'cover']],
    ['east-mid', [12, 0, 4], ['lane', 'cover']],
    ['west-north', [-12, 0, -8], ['lane', 'cover', 'flank']],
    ['east-north', [12, 0, -8], ['lane', 'cover', 'flank']],
    ['north-center', [0, 0, -16], ['lane', 'sniper']],
    ['far-west', [-20, 0, 0], ['flank', 'cover']],
    ['far-east', [20, 0, 0], ['flank', 'cover']],
  ];
  for (const [id, position, tags] of nodes) {
    graph.addNode({ id, position: new THREE.Vector3(...position), tags });
  }
  const edges: Array<[string, string]> = [
    ['south-center', 'south-west'], ['south-center', 'south-east'],
    ['south-west', 'west-mid'], ['south-east', 'east-mid'],
    ['west-mid', 'west-north'], ['east-mid', 'east-north'],
    ['west-north', 'north-center'], ['east-north', 'north-center'],
    ['west-mid', 'far-west'], ['east-mid', 'far-east'],
    ['far-west', 'west-north'], ['far-east', 'east-north'],
  ];
  for (const [from, to] of edges) {
    graph.addBidirectionalEdge(from, to);
  }
  return graph;
}
