import * as THREE from 'three';
import type { StaticBoxColliderDefinition } from '../../physics/CollisionWorld';

export interface BoxOptions {
  name: string;
  size: readonly [number, number, number];
  position: readonly [number, number, number];
  material: THREE.Material;
  rotation?: readonly [number, number, number];
  collision?: boolean;
}

export interface CylinderOptions {
  name: string;
  radius: number;
  height: number;
  position: readonly [number, number, number];
  material: THREE.Material;
  collision?: boolean;
}

export interface SphereOptions {
  name: string;
  radius: number;
  position: readonly [number, number, number];
  material: THREE.Material;
  scale?: readonly [number, number, number];
  collision?: boolean;
}

export class GeometryFactory {
  public readonly root = new THREE.Group();
  public readonly collisionDefinitions: StaticBoxColliderDefinition[] = [];
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();

  public constructor(name: string) {
    this.root.name = name;
  }

  public trackMaterial(material: THREE.Material): THREE.Material {
    this.materials.add(material);
    return material;
  }

  public box(options: BoxOptions): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...options.size), options.material);
    this.geometries.add(mesh.geometry);
    this.materials.add(options.material);
    mesh.name = options.name;
    mesh.position.set(...options.position);
    if (options.rotation) mesh.rotation.set(...options.rotation);
    this.root.add(mesh);
    if (options.collision !== false) {
      this.collisionDefinitions.push({
        name: options.name,
        size: options.size,
        position: options.position,
        rotation: options.rotation,
      });
    }
    return mesh;
  }

  public cylinder(options: CylinderOptions): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(options.radius, options.radius, options.height, 12), options.material);
    this.geometries.add(mesh.geometry);
    this.materials.add(options.material);
    mesh.name = options.name;
    mesh.position.set(...options.position);
    this.root.add(mesh);
    if (options.collision) {
      this.collisionDefinitions.push({
        name: options.name,
        size: [options.radius * 2, options.height, options.radius * 2],
        position: options.position,
      });
    }
    return mesh;
  }

  public sphere(options: SphereOptions): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(options.radius, 12, 8), options.material);
    this.geometries.add(mesh.geometry);
    this.materials.add(options.material);
    mesh.name = options.name;
    mesh.position.set(...options.position);
    if (options.scale) mesh.scale.set(...options.scale);
    this.root.add(mesh);
    if (options.collision) {
      const scale = options.scale ?? [1, 1, 1];
      this.collisionDefinitions.push({
        name: options.name,
        size: [options.radius * 2 * scale[0], options.radius * 2 * scale[1], options.radius * 2 * scale[2]],
        position: options.position,
      });
    }
    return mesh;
  }

  public grid(size: number, divisions: number, position: readonly [number, number, number], colors: readonly [number, number]): THREE.GridHelper {
    const grid = new THREE.GridHelper(size, divisions, colors[0], colors[1]);
    grid.name = 'FloorGrid';
    grid.position.set(...position);
    this.root.add(grid);
    this.geometries.add(grid.geometry);
    if (Array.isArray(grid.material)) grid.material.forEach((material) => this.materials.add(material));
    else this.materials.add(grid.material);
    return grid;
  }

  public addLight(light: THREE.Light): THREE.Light {
    this.root.add(light);
    return light;
  }

  public addGroup(group: THREE.Object3D): THREE.Object3D {
    this.root.add(group);
    return group;
  }

  public dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.root.clear();
    this.geometries.clear();
    this.materials.clear();
    this.collisionDefinitions.length = 0;
  }
}
