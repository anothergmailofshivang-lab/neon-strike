import * as THREE from 'three';
import type { CharacterAppearance, CharacterDefinition } from './CharacterTypes';
import { validateAppearance } from './CharacterCustomization';

export class CharacterVisualAdapter {
  public readonly root = new THREE.Group();
  private readonly left = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.5), new THREE.MeshStandardMaterial({ metalness: 0.45, roughness: 0.5 }));
  private readonly right = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.5), new THREE.MeshStandardMaterial({ metalness: 0.45, roughness: 0.5 }));
  private readonly leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.18), new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.58 }));
  private readonly rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.18), new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.58 }));
  private readonly chest = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.08), new THREE.MeshStandardMaterial({ metalness: 0.3, roughness: 0.45 }));
  private animationTime = 0;

  public constructor(parent: THREE.Object3D) {
    this.root.name = 'PlayerCharacterVisual';
    this.root.position.set(0, -0.2, 0.1);
    this.left.position.set(-0.2, 0, -0.33);
    this.left.rotation.y = -0.7;
    this.leftHand.position.set(-0.2, -0.01, -0.59);
    this.leftHand.rotation.y = -0.7;
    this.right.position.set(0.02, 0, 0.23);
    this.rightHand.position.set(0.02, -0.01, 0.49);
    this.chest.position.set(0.02, 0.075, 0.23);
    this.chest.scale.set(0.4, 0.5, 1);
    this.root.add(this.left, this.right, this.leftHand, this.rightHand, this.chest);
    parent.add(this.root);
  }

  public apply(definition: CharacterDefinition, appearance: CharacterAppearance): void {
    validateAppearance(definition, appearance);
    const palette = definition.palettes.find((entry) => entry.id === appearance.paletteId) ?? definition.palettes[0];
    for (const mesh of [this.left, this.right]) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.setHex(palette.secondary);
      material.emissive.setHex(palette.emissive);
      material.emissiveIntensity = 0.35;
      mesh.scale.set(definition.silhouette === 'heavy' ? 1.3 : 1, definition.silhouette === 'robotic' ? 0.7 : 1, 1);
    }
    for (const hand of [this.leftHand, this.rightHand]) {
      const material = hand.material as THREE.MeshStandardMaterial;
      material.color.setHex(palette.primary);
      material.emissive.setHex(palette.emissive);
      material.emissiveIntensity = 0.18;
      hand.scale.setScalar(definition.silhouette === 'heavy' ? 1.2 : definition.silhouette === 'slender' ? 0.88 : 1);
    }
    const chestMaterial = this.chest.material as THREE.MeshStandardMaterial;
    chestMaterial.color.setHex(palette.accent);
    chestMaterial.emissive.setHex(palette.emissive);
    chestMaterial.emissiveIntensity = 1.2;
    this.root.userData.characterId = definition.id;
    this.root.userData.paletteId = palette.id;
  }

  public setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  public update(deltaSeconds: number, recoilOffset = 0): void {
    const delta = Math.min(Math.max(deltaSeconds, 0), 0.1);
    this.animationTime += delta;
    const sway = Math.sin(this.animationTime * 4.5) * 0.008;
    this.root.rotation.x = sway - recoilOffset * 0.08;
    this.left.rotation.z = -sway * 1.6;
    this.right.rotation.z = sway * 1.6;
    this.leftHand.rotation.z = -sway * 1.6;
    this.rightHand.rotation.z = sway * 1.6;
    this.root.position.y = -0.2 - recoilOffset * 0.5;
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material?.dispose();
    });
    this.root.clear();
  }
}
