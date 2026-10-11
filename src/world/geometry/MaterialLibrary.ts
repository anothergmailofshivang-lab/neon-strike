import * as THREE from 'three';
import { GeometryFactory } from './GeometryFactory';

export interface MaterialPalette {
  floor: THREE.MeshStandardMaterial;
  structure: THREE.MeshStandardMaterial;
  secondary: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  warning: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  pickup: THREE.MeshStandardMaterial;
}

export function createMaterialPalette(factory: GeometryFactory, colors: {
  floor: number;
  structure: number;
  secondary: number;
  dark: number;
  trim: number;
  warning: number;
  accent: number;
}): MaterialPalette {
  const material = (color: number, emissive = 0x000000, emissiveIntensity = 0, roughness = 0.68): THREE.MeshStandardMaterial => {
    const result = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: 0.4,
      emissive,
      emissiveIntensity,
    });
    factory.trackMaterial(result);
    return result;
  };
  return {
    floor: material(colors.floor, colors.dark, 0.15),
    structure: material(colors.structure, colors.dark, 0.2),
    secondary: material(colors.secondary, colors.dark, 0.12),
    dark: material(colors.dark, colors.dark, 0.05),
    trim: material(colors.trim, colors.trim, 1.8, 0.4),
    warning: material(colors.warning, colors.warning, 1.1, 0.5),
    accent: material(colors.accent, colors.accent, 1.4, 0.45),
    pickup: material(0xefffff, colors.accent, 2.4, 0.22),
  };
}

export function addStrip(factory: GeometryFactory, material: THREE.Material, name: string, position: readonly [number, number, number], size: readonly [number, number, number]): void {
  factory.box({ name, size, position, material, collision: false });
}

export function addGuardrail(factory: GeometryFactory, material: THREE.Material, name: string, position: readonly [number, number, number], size: readonly [number, number, number], rotation?: readonly [number, number, number]): void {
  factory.box({ name, size, position, material, rotation });
}
