import * as THREE from 'three';
import type { NPCDebugSnapshot } from '../ai/NPCController';
import type { MapInstance } from '../world/MapInstance';

export function worldToMinimap(position: THREE.Vector3, dimensions: readonly [number, number], size = 208, inset = 13): readonly [number, number] {
  const [width, depth] = dimensions;
  const mapSize = size - inset * 2;
  return [
    inset + ((position.x + width / 2) / width) * mapSize,
    inset + ((position.z + depth / 2) / depth) * mapSize,
  ];
}

export function playerArrowRotation(yaw: number): number {
  return Math.atan2(-Math.sin(yaw), Math.cos(yaw));
}

export class Minimap {
  public readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private map: MapInstance | null = null;
  private visible = false;
  private readonly size = 208;

  public constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'match-minimap-canvas';
    this.canvas.width = this.size * this.pixelRatio;
    this.canvas.height = this.size * this.pixelRatio;
    this.canvas.setAttribute('aria-label', 'Live match minimap');
    this.canvas.setAttribute('role', 'img');
    parent.appendChild(this.canvas);
    this.context = this.canvas.getContext('2d');
    this.setVisible(false);
  }

  public setMap(map: MapInstance | null): void {
    this.map = map;
    this.draw(null, 0, []);
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.canvas.hidden = !visible;
  }

  public update(playerPosition: THREE.Vector3, playerYaw: number, npcs: readonly NPCDebugSnapshot[] = []): void {
    if (!this.visible || !this.map) return;
    this.draw(playerPosition, playerYaw, npcs);
  }

  public dispose(): void {
    this.canvas.remove();
    this.map = null;
  }

  private draw(playerPosition: THREE.Vector3 | null, playerYaw: number, npcs: readonly NPCDebugSnapshot[]): void {
    const context = this.context;
    if (!context) return;
    const ratio = this.pixelRatio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, this.size, this.size);
    context.fillStyle = 'rgba(4, 15, 26, 0.92)';
    context.fillRect(0, 0, this.size, this.size);
    if (!this.map) return;

    const [width, depth] = this.map.definition.dimensions;
    const inset = 13;
    const mapSize = this.size - inset * 2;
    const toCanvas = (position: THREE.Vector3): readonly [number, number] => worldToMinimap(position, [width, depth], this.size, inset);

    context.strokeStyle = 'rgba(105, 221, 239, 0.75)';
    context.lineWidth = 1;
    context.strokeRect(inset, inset, mapSize, mapSize);
    const pixelsPerWorldX = mapSize / width;
    const pixelsPerWorldZ = mapSize / depth;
    for (const collider of this.map.collisionDefinitions) {
      if (/PlayableFloor|ForestFloor|KingdomGround/.test(collider.name)) continue;
      const [x, y] = worldToMinimap(new THREE.Vector3(...collider.position), [width, depth], this.size, inset);
      const [colliderWidth, , colliderDepth] = collider.size;
      context.save();
      context.translate(x, y);
      context.rotate(collider.rotation?.[1] ?? 0);
      context.fillStyle = collider.name.includes('Boundary')
        ? 'rgba(4, 10, 17, 0.82)'
        : 'rgba(126, 181, 194, 0.22)';
      context.strokeStyle = collider.name.includes('Boundary')
        ? 'rgba(105, 221, 239, 0.6)'
        : 'rgba(126, 181, 194, 0.45)';
      context.lineWidth = 1;
      context.fillRect(-colliderWidth * pixelsPerWorldX / 2, -colliderDepth * pixelsPerWorldZ / 2, colliderWidth * pixelsPerWorldX, colliderDepth * pixelsPerWorldZ);
      context.strokeRect(-colliderWidth * pixelsPerWorldX / 2, -colliderDepth * pixelsPerWorldZ / 2, colliderWidth * pixelsPerWorldX, colliderDepth * pixelsPerWorldZ);
      context.restore();
    }
    context.strokeStyle = 'rgba(100, 234, 255, 0.28)';
    context.lineWidth = 1.5;
    const drawnEdges = new Set<string>();
    for (const node of this.map.navigationGraph.getAllNodes()) {
      for (const edge of this.map.navigationGraph.getNeighbors(node.id)) {
        const key = [edge.from, edge.to].sort().join('|');
        if (drawnEdges.has(key)) continue;
        drawnEdges.add(key);
        const destination = this.map.navigationGraph.getNode(edge.to);
        if (!destination) continue;
        const [fromX, fromY] = toCanvas(node.position);
        const [toX, toY] = toCanvas(destination.position);
        context.beginPath();
        context.moveTo(fromX, fromY);
        context.lineTo(toX, toY);
        context.stroke();
      }
    }
    for (const node of this.map.navigationGraph.getAllNodes()) {
      const [x, y] = toCanvas(node.position);
      const isCover = node.tags.includes('cover') || node.tags.includes('interior');
      context.fillStyle = isCover ? 'rgba(255, 183, 92, 0.8)' : 'rgba(172, 238, 245, 0.64)';
      context.fillRect(x - (isCover ? 2 : 1), y - (isCover ? 2 : 1), isCover ? 4 : 2, isCover ? 4 : 2);
    }

    for (const npc of npcs) {
      if (!npc.visible || npc.health <= 0) continue;
      const [x, y] = toCanvas(npc.position);
      context.fillStyle = '#ff766d';
      context.beginPath();
      context.arc(x, y, 3, 0, Math.PI * 2);
      context.fill();
    }

    if (playerPosition) {
      const [x, y] = toCanvas(playerPosition);
      // Three.js forward is local -Z. The canvas arrow starts pointing north.
      context.save();
      context.translate(x, y);
      context.rotate(playerArrowRotation(playerYaw));
      context.fillStyle = '#f4ffff';
      context.strokeStyle = '#37e4ff';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, -8);
      context.lineTo(5, 6);
      context.lineTo(0, 3);
      context.lineTo(-5, 6);
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();
    }
  }

  private get pixelRatio(): number {
    return Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  }
}
