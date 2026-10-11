import * as THREE from 'three';
import type { CharacterAppearance, CharacterDefinition, CharacterPalette, CharacterVisual } from './CharacterTypes';
import { validateAppearance } from './CharacterCustomization';

export function createCharacterVisual(definition: CharacterDefinition, rawAppearance?: CharacterAppearance): CharacterVisual {
  const appearance = validateAppearance(definition, rawAppearance ?? { characterId: definition.id, ...definition.defaultAppearance });
  const palette = definition.palettes.find((entry) => entry.id === appearance.paletteId) as CharacterPalette;
  const root = new THREE.Group();
  root.name = `Character:${definition.id}`;
  root.scale.setScalar(definition.previewScale);
  const geometries = new Set<THREE.BufferGeometry>();
  const geometryCache = new Map<string, THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const standard = (color: number, emissive = 0x000000, intensity = 0.1, roughness = 0.55): THREE.MeshStandardMaterial => {
    const material = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness, metalness: 0.4 });
    materials.add(material);
    return material;
  };
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, name: string, position: [number, number, number]): THREE.Mesh => {
    geometries.add(geometry);
    const result = new THREE.Mesh(geometry, material);
    result.name = name;
    result.position.set(...position);
    root.add(result);
    return result;
  };
  const box = (size: [number, number, number], material: THREE.Material, name: string, position: [number, number, number]): THREE.Mesh => {
    const key = size.join(',');
    let geometry = geometryCache.get(key);
    if (!geometry) {
      geometry = new THREE.BoxGeometry(...size);
      geometryCache.set(key, geometry);
    }
    return mesh(geometry, material, name, position);
  };
  const bodyMaterial = standard(palette.primary, palette.emissive, 0.18);
  const armorMaterial = standard(palette.secondary, 0x000000, 0.05, 0.42);
  const accentMaterial = standard(palette.accent, palette.emissive, 1.35, 0.38);
  const visorMaterial = standard(palette.visor, palette.emissive, 1.8, 0.25);
  const bodySize = definition.silhouette === 'heavy' ? [0.95, 1.35, 0.55] : definition.silhouette === 'robotic' ? [0.72, 1.25, 0.62] : [0.72, 1.3, 0.48];
  const body = definition.silhouette === 'robotic' || definition.silhouette === 'angular'
    ? mesh(new THREE.BoxGeometry(...bodySize), bodyMaterial, 'body', [0, 1.05, 0])
    : mesh(new THREE.CapsuleGeometry(bodySize[0] * 0.42, bodySize[1] * 0.62, 5, 10), bodyMaterial, 'body', [0, 1.05, 0]);
  const head = definition.silhouette === 'robotic'
    ? mesh(new THREE.BoxGeometry(0.58, 0.52, 0.58), armorMaterial, 'head', [0, 1.98, 0])
    : mesh(new THREE.SphereGeometry(definition.silhouette === 'heavy' ? 0.34 : 0.29, 14, 10), armorMaterial, 'head', [0, 1.98, 0]);
  const visor = mesh(new THREE.BoxGeometry(definition.silhouette === 'robotic' ? 0.4 : 0.38, 0.1, 0.06), visorMaterial, 'visor', [0, 2.01, -0.27]);
  const leftArm = mesh(new THREE.BoxGeometry(definition.silhouette === 'heavy' ? 0.25 : 0.18, 0.85, 0.22), armorMaterial, 'left-arm', [-0.53, 1.1, 0]);
  const rightArm = mesh(new THREE.BoxGeometry(definition.silhouette === 'heavy' ? 0.25 : 0.18, 0.85, 0.22), armorMaterial, 'right-arm', [0.53, 1.1, 0]);
  const legMaterial = standard(palette.secondary, 0x000000, 0.04, 0.62);
  const leftLeg = mesh(new THREE.BoxGeometry(0.23, 0.85, 0.28), legMaterial, 'left-leg', [-0.2, 0.34, 0]);
  const rightLeg = mesh(new THREE.BoxGeometry(0.23, 0.85, 0.28), legMaterial, 'right-leg', [0.2, 0.34, 0]);
  leftLeg.position.y = rightLeg.position.y = 0.45;
  for (const side of [-1, 1]) {
    box([0.27, 0.16, 0.4], bodyMaterial, `boot:${side}`, [side * 0.2, 0.08, -0.07]);
    box([0.18, 0.16, 0.24], bodyMaterial, `glove:${side}`, [side * 0.53, 0.62, -0.02]);
  }
  const weapon = mesh(new THREE.BoxGeometry(0.13, 0.13, 0.62), accentMaterial, 'weapon', [0.38, 1.18, -0.3]);
  const chest = mesh(new THREE.BoxGeometry(definition.silhouette === 'heavy' ? 0.65 : 0.5, 0.22, 0.06), accentMaterial, 'chest-accent', [0, 1.28, -0.26]);
  if (appearance.outfitVariantId === 'reinforced' || appearance.outfitVariantId === 'bulwark' || appearance.outfitVariantId === 'industrial') {
    chest.scale.set(1.15, 1.25, 1.2);
  }
  if (appearance.outfitVariantId === 'longcoat') {
    const coat = mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.1, 8), bodyMaterial, 'longcoat', [0, 0.68, 0]);
    coat.scale.z = 0.72;
  }
  if (appearance.headVariantId === 'sealed-helmet' || appearance.headVariantId === 'dual-sensor') {
    const antenna = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 6), accentMaterial, 'sensor-antenna', [0, 2.38, 0]);
    antenna.rotation.z = appearance.headVariantId === 'dual-sensor' ? 0.28 : 0;
  }
  if (appearance.headVariantId === 'helmet' || appearance.headVariantId === 'sealed-helmet') {
    box([0.66, 0.14, 0.66], bodyMaterial, 'helmet-brim', [0, 2.16, 0]);
    if (appearance.headVariantId === 'sealed-helmet') box([0.48, 0.17, 0.12], bodyMaterial, 'jaw-guard', [0, 1.85, -0.28]);
  }
  if (appearance.headVariantId === 'split-visor' || appearance.headVariantId === 'dual-sensor') {
    visor.scale.x = 0.38;
    visor.position.x = -0.13;
    box([0.14, 0.1, 0.06], visorMaterial, 'second-sensor', [0.13, 2.01, -0.3]);
  }
  if (appearance.headVariantId === 'hooded-visor') {
    box([0.63, 0.1, 0.63], bodyMaterial, 'hood-top', [0, 2.26, 0]);
    for (const side of [-1, 1]) box([0.08, 0.5, 0.55], bodyMaterial, `hood:${side}`, [side * 0.3, 1.98, 0.04]);
  }
  if (definition.silhouette === 'angular') {
    body.scale.x = 0.78;
    for (const side of [-1, 1]) {
      const fin = box([0.12, 0.45, 0.38], armorMaterial, `volt-fin:${side}`, [side * 0.48, 1.65, 0.08]);
      fin.rotation.z = -side * 0.55;
    }
  }
  if (appearance.outfitVariantId === 'pulse') {
    for (const side of [-1, 1]) box([0.045, 0.7, 0.04], accentMaterial, `pulse-track:${side}`, [side * 0.22, 1.1, -0.29]);
  }
  if (definition.silhouette === 'heavy') {
    for (const side of [-1, 1]) box([0.38, 0.28, 0.5], armorMaterial, `bastion-pauldron:${side}`, [side * 0.52, 1.65, 0]);
  }
  if (definition.silhouette === 'slender') {
    body.scale.x = 0.8;
    leftArm.position.x = -0.45;
    rightArm.position.x = 0.45;
  }
  if (definition.silhouette === 'robotic') {
    for (const side of [-1, 1]) {
      mesh(new THREE.SphereGeometry(0.14, 8, 6), accentMaterial, `knee-joint:${side}`, [side * 0.2, 0.47, -0.14]);
      box([0.13, 0.42, 0.12], accentMaterial, `actuator:${side}`, [side * 0.53, 1.06, -0.12]);
    }
  }
  if (appearance.accessoryIds.includes('shoulder-plate')) {
    mesh(new THREE.BoxGeometry(0.38, 0.16, 0.38), accentMaterial, 'shoulder-plate', [-0.47, 1.62, 0]);
  }
  if (appearance.accessoryIds.includes('back-cell')) {
    mesh(new THREE.BoxGeometry(0.28, 0.46, 0.14), accentMaterial, 'back-cell', [0, 1.28, 0.28]);
  }
  let disposed = false;
  return {
    root, body, head, weapon, appearance,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      root.clear();
      geometries.clear();
      materials.clear();
      geometryCache.clear();
    },
  };
}
