import * as THREE from 'three';

interface VisibilityField {
  id: string;
  center: THREE.Vector3;
  radius: number;
  remaining: number;
}

/** Shared gameplay visibility approximation used by smoke and NPC perception. */
export class VisibilityFieldRegistry {
  private readonly fields = new Map<string, VisibilityField>();

  public add(id: string, center: THREE.Vector3, radius: number, duration: number): void {
    this.fields.set(id, { id, center: center.clone(), radius: Math.max(radius, 0), remaining: Math.max(duration, 0) });
  }

  public update(deltaSeconds: number): void {
    for (const field of this.fields.values()) {
      field.remaining = Math.max(field.remaining - Math.max(deltaSeconds, 0), 0);
      if (field.remaining === 0) this.fields.delete(field.id);
    }
  }

  public blocksLineOfSight(origin: THREE.Vector3, target: THREE.Vector3): boolean {
    for (const field of this.fields.values()) {
      if (segmentDistanceSquared(origin, target, field.center) <= field.radius * field.radius) return true;
    }
    return false;
  }

  public clear(): void { this.fields.clear(); }
  public remove(id: string): void { this.fields.delete(id); }
}

function segmentDistanceSquared(start: THREE.Vector3, end: THREE.Vector3, point: THREE.Vector3): number {
  const segment = end.clone().sub(start);
  const lengthSquared = segment.lengthSq();
  const t = lengthSquared > 0 ? Math.max(0, Math.min(1, point.clone().sub(start).dot(segment) / lengthSquared)) : 0;
  return point.distanceToSquared(start.clone().addScaledVector(segment, t));
}
