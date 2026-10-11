import * as THREE from 'three';

interface ActiveLine {
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  remaining: number;
}

interface ActiveImpact {
  mesh: THREE.Mesh;
  remaining: number;
}

export class CombatEffects {
  public readonly group = new THREE.Group();
  private readonly lines: ActiveLine[] = [];
  private readonly impacts: ActiveImpact[] = [];
  private readonly tracerMaterials = new Map<number, THREE.LineBasicMaterial>();
  private readonly impactMaterials = new Map<number, THREE.MeshBasicMaterial>();
  private readonly impactGeometry = new THREE.SphereGeometry(0.045, 6, 4);

  public constructor(scene: THREE.Scene) {
    this.group.name = 'CombatEffects';
    scene.add(this.group);
  }

  public spawnTracer(start: THREE.Vector3, end: THREE.Vector3, color: number): void {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = this.getTracerMaterial(color);
    const line = new THREE.Line(geometry, material);
    this.group.add(line);
    this.lines.push({ line, remaining: 0.06 });
  }

  public spawnImpact(point: THREE.Vector3, color: number, critical = false): void {
    const material = this.getImpactMaterial(color);
    const mesh = new THREE.Mesh(this.impactGeometry, material);
    mesh.position.copy(point);
    mesh.scale.setScalar(critical ? 1.8 : 1);
    this.group.add(mesh);
    this.impacts.push({ mesh, remaining: critical ? 0.22 : 0.14 });
  }

  public update(deltaSeconds: number): void {
    this.updateLines(deltaSeconds);
    this.updateImpacts(deltaSeconds);
  }

  public dispose(): void {
    for (const entry of this.lines) {
      entry.line.geometry.dispose();
      this.group.remove(entry.line);
    }
    for (const entry of this.impacts) {
      this.group.remove(entry.mesh);
    }
    for (const material of this.tracerMaterials.values()) {
      material.dispose();
    }
    for (const material of this.impactMaterials.values()) {
      material.dispose();
    }
    this.impactGeometry.dispose();
    this.lines.length = 0;
    this.impacts.length = 0;
    this.group.removeFromParent();
  }

  private updateLines(deltaSeconds: number): void {
    for (let index = this.lines.length - 1; index >= 0; index -= 1) {
      const entry = this.lines[index];
      entry.remaining -= deltaSeconds;
      entry.line.material.opacity = Math.max(entry.remaining / 0.06, 0);
      if (entry.remaining <= 0) {
        entry.line.geometry.dispose();
        this.group.remove(entry.line);
        this.lines.splice(index, 1);
      }
    }
  }

  private updateImpacts(deltaSeconds: number): void {
    for (let index = this.impacts.length - 1; index >= 0; index -= 1) {
      const entry = this.impacts[index];
      entry.remaining -= deltaSeconds;
      entry.mesh.scale.multiplyScalar(1 + deltaSeconds * 4);
      if (!Array.isArray(entry.mesh.material)) {
        entry.mesh.material.opacity = Math.max(entry.remaining / 0.22, 0);
      }
      if (entry.remaining <= 0) {
        this.group.remove(entry.mesh);
        this.impacts.splice(index, 1);
      }
    }
  }

  private getTracerMaterial(color: number): THREE.LineBasicMaterial {
    const existing = this.tracerMaterials.get(color);
    if (existing) {
      return existing;
    }
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 });
    this.tracerMaterials.set(color, material);
    return material;
  }

  private getImpactMaterial(color: number): THREE.MeshBasicMaterial {
    const existing = this.impactMaterials.get(color);
    if (existing) {
      return existing;
    }
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    this.impactMaterials.set(color, material);
    return material;
  }
}
