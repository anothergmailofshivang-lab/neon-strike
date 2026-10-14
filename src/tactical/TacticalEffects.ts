import * as THREE from 'three';

interface Effect { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; age: number; duration: number; radius: number; }

/** Bounded presentation only. Effects never deal damage or mutate inventory. */
export class TacticalEffects {
  private readonly sphere = new THREE.IcosahedronGeometry(1, 1);
  private readonly ring = new THREE.TorusGeometry(1, 0.03, 4, 32);
  private readonly cube = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  private readonly effects: Effect[] = [];
  public constructor(private readonly root: THREE.Group) {}

  public pulse(center: THREE.Vector3, color: number, radius: number, kind: 'blast' | 'ring' | 'break' = 'ring'): void {
    const count = kind === 'blast' || kind === 'break' ? 9 : 1;
    for (let index = 0; index < count; index++) {
      while (this.effects.length >= 48) this.remove(0);
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false });
      const mesh = new THREE.Mesh(index > 0 ? this.cube : kind === 'blast' ? this.sphere : this.ring, material);
      mesh.position.copy(center);
      if (index > 0) mesh.position.add(new THREE.Vector3(Math.cos(index * 2.4), Math.sin(index) * 0.5, Math.sin(index * 2.4)));
      else if (kind !== 'blast') mesh.rotation.x = Math.PI / 2;
      this.root.add(mesh);
      this.effects.push({ mesh, age: 0, duration: 0.6, radius: index > 0 ? 1 : radius });
    }
  }

  public update(delta: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.age += delta;
      if (effect.age >= effect.duration) { this.remove(i); continue; }
      const fraction = effect.age / effect.duration;
      effect.mesh.scale.setScalar(Math.max(0.1, effect.radius * fraction));
      effect.mesh.material.opacity = 0.55 * (1 - fraction);
    }
  }

  public clear(): void { while (this.effects.length) this.remove(0); }
  public dispose(): void { this.clear(); this.sphere.dispose(); this.ring.dispose(); this.cube.dispose(); }
  private remove(index: number): void {
    const [effect] = this.effects.splice(index, 1);
    effect.mesh.removeFromParent();
    effect.mesh.material.dispose();
  }
}
