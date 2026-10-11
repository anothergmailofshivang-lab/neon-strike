import * as THREE from 'three';
import type { StaticBoxColliderDefinition } from '../physics/CollisionWorld';

export class PracticeArena {
  public readonly group = new THREE.Group();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly collisionDefinitions: StaticBoxColliderDefinition[] = [];

  public constructor() {
    this.group.name = 'PracticeArena';
    this.createEnvironment();
    this.createCollisionDefinitions();
  }

  public getCollisionDefinitions(): readonly StaticBoxColliderDefinition[] {
    return this.collisionDefinitions;
  }

  public dispose(): void {
    for (const geometry of this.geometries) {
      geometry.dispose();
    }
    for (const material of this.materials) {
      material.dispose();
    }
    this.group.clear();
    this.geometries.clear();
    this.materials.clear();
  }

  private createEnvironment(): void {
    const floorMaterial = this.material(0x15263b, 0x07111a);
    const darkMetal = this.material(0x24354b, 0x050b13);
    const panelMaterial = this.material(0x49627b, 0x071321);
    const cyanMaterial = this.material(0x12cde8, 0x00b8d4, 2.8);
    const orangeMaterial = this.material(0xff773f, 0xa72d12, 2.2);
    const yellowMaterial = this.material(0xffc857, 0xb15d10, 1.5);
    const neutralMaterial = this.material(0x68758b, 0x101522);

    this.addMesh(new THREE.PlaneGeometry(52, 40), floorMaterial, [0, 0, 0], 'ArenaFloor', (mesh) => {
      mesh.rotation.x = -Math.PI / 2;
    });

    const grid = new THREE.GridHelper(52, 26, 0x2b5875, 0x1b3047);
    grid.position.y = 0.012;
    grid.name = 'FloorGrid';
    this.group.add(grid);
    this.geometries.add(grid.geometry);
    if (Array.isArray(grid.material)) {
      grid.material.forEach((material) => this.materials.add(material));
    } else {
      this.materials.add(grid.material);
    }

    this.addBox(darkMetal, [52, 5, 1], [0, 2.5, -20], 'NorthBoundary');
    this.addBox(darkMetal, [52, 5, 1], [0, 2.5, 20], 'SouthBoundary');
    this.addBox(panelMaterial, [1, 5, 40], [-26, 2.5, 0], 'WestBoundary');
    this.addBox(panelMaterial, [1, 5, 40], [26, 2.5, 0], 'EastBoundary');

    this.addBox(cyanMaterial, [20, 0.18, 0.22], [0, 4.3, -19.35], 'NorthCyanTrim');
    this.addBox(orangeMaterial, [20, 0.18, 0.22], [0, 4.3, 19.35], 'SouthOrangeTrim');
    this.addBox(cyanMaterial, [0.22, 0.18, 18], [-25.35, 4.3, 0], 'WestCyanTrim');
    this.addBox(orangeMaterial, [0.22, 0.18, 18], [25.35, 4.3, 0], 'EastOrangeTrim');

    this.addBox(neutralMaterial, [8, 1.3, 2], [-13, 0.65, -5], 'LowBarrierWest');
    this.addBox(neutralMaterial, [6, 1.3, 2], [13, 0.65, 5], 'LowBarrierEast');
    this.addBox(panelMaterial, [3, 2.5, 3], [-5, 1.25, 10], 'ObstacleSouthWest');
    this.addBox(panelMaterial, [3, 2.5, 3], [6, 1.25, -10], 'ObstacleNorthEast');

    this.addBox(darkMetal, [8, 2.8, 5], [0, 1.4, 0], 'CentralCover');
    this.addBox(cyanMaterial, [8.2, 0.18, 0.2], [0, 2.82, -2.4], 'CentralCyanTrim');
    this.addBox(orangeMaterial, [8.2, 0.18, 0.2], [0, 2.82, 2.4], 'CentralOrangeTrim');

    this.addBox(panelMaterial, [7, 1.2, 4], [-14, 4.2, 12], 'RaisedPlatformWest');
    this.addBox(panelMaterial, [7, 1.2, 4], [14, 4.2, -12], 'RaisedPlatformEast');
    this.addBox(yellowMaterial, [7.2, 0.14, 0.2], [-14, 4.84, 12], 'PlatformWestMarking');
    this.addBox(yellowMaterial, [7.2, 0.14, 0.2], [14, 4.84, -12], 'PlatformEastMarking');

    const ramp = this.addBox(darkMetal, [7, 1.4, 6], [15, 0.7, -2], 'RampEast');
    ramp.rotation.z = -0.22;
    const rampTrim = this.addBox(cyanMaterial, [7, 0.14, 0.2], [15, 1.43, -2], 'RampEastTrim');
    rampTrim.rotation.z = -0.22;

    this.addPillar(-19, -13, cyanMaterial, 'CyanLandmarkA');
    this.addPillar(19, 13, orangeMaterial, 'OrangeLandmarkB');
    this.addPillar(-19, 13, yellowMaterial, 'YellowLandmarkC');
    this.addPillar(19, -13, cyanMaterial, 'CyanLandmarkD');
  }

  private createCollisionDefinitions(): void {
    this.addCollisionBox('ArenaFloor', [52, 0.2, 40], [0, -0.1, 0]);
    this.addCollisionBox('NorthBoundary', [52, 5, 1], [0, 2.5, -20]);
    this.addCollisionBox('SouthBoundary', [52, 5, 1], [0, 2.5, 20]);
    this.addCollisionBox('WestBoundary', [1, 5, 40], [-26, 2.5, 0]);
    this.addCollisionBox('EastBoundary', [1, 5, 40], [26, 2.5, 0]);

    this.addCollisionBox('LowBarrierWest', [8, 1.3, 2], [-13, 0.65, -5]);
    this.addCollisionBox('LowBarrierEast', [6, 1.3, 2], [13, 0.65, 5]);
    this.addCollisionBox('ObstacleSouthWest', [3, 2.5, 3], [-5, 1.25, 10]);
    this.addCollisionBox('ObstacleNorthEast', [3, 2.5, 3], [6, 1.25, -10]);
    this.addCollisionBox('CentralCover', [8, 2.8, 5], [0, 1.4, 0]);
    this.addCollisionBox('RaisedPlatformWest', [7, 1.2, 4], [-14, 4.2, 12]);
    this.addCollisionBox('RaisedPlatformEast', [7, 1.2, 4], [14, 4.2, -12]);
    this.addCollisionBox('RampEast', [7, 1.4, 6], [15, 0.7, -2], [0, 0, -0.22]);

    this.addCollisionBox('CyanLandmarkABase', [1.4, 6, 1.4], [-19, 3, -13]);
    this.addCollisionBox('OrangeLandmarkBBase', [1.4, 6, 1.4], [19, 3, 13]);
    this.addCollisionBox('YellowLandmarkCBase', [1.4, 6, 1.4], [-19, 3, 13]);
    this.addCollisionBox('CyanLandmarkDBase', [1.4, 6, 1.4], [19, 3, -13]);
  }

  private addPillar(
    x: number,
    z: number,
    material: THREE.Material,
    name: string,
  ): void {
    this.addBox(this.material(0x202d42, 0x050a12), [1.4, 6, 1.4], [x, 3, z], `${name}Base`);
    this.addBox(material, [1.65, 0.22, 1.65], [x, 6.1, z], `${name}Cap`);
  }

  private addBox(
    material: THREE.Material,
    size: [number, number, number],
    position: [number, number, number],
    name: string,
  ): THREE.Mesh {
    const mesh = this.addMesh(new THREE.BoxGeometry(...size), material, position, name);
    return mesh;
  }

  private addCollisionBox(
    name: string,
    size: readonly [number, number, number],
    position: readonly [number, number, number],
    rotation?: readonly [number, number, number],
  ): void {
    this.collisionDefinitions.push({ name, size, position, rotation });
  }

  private addMesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    name: string,
    configure?: (mesh: THREE.Mesh) => void,
  ): THREE.Mesh {
    this.geometries.add(geometry);
    this.materials.add(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.name = name;
    configure?.(mesh);
    this.group.add(mesh);
    return mesh;
  }

  private material(color: THREE.ColorRepresentation, emissive: THREE.ColorRepresentation, emissiveIntensity = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.72,
      metalness: 0.42,
      emissive,
      emissiveIntensity,
    });
    this.materials.add(material);
    return material;
  }
}
