import type * as THREE from 'three';

export type CharacterCategory = 'tactical' | 'specialist' | 'armored' | 'precision' | 'synthetic';

export interface CharacterPalette {
  id: string;
  displayName: string;
  primary: number;
  secondary: number;
  accent: number;
  visor: number;
  emissive: number;
}

export interface CharacterAppearance {
  characterId: string;
  paletteId: string;
  outfitVariantId: string;
  headVariantId: string;
  accessoryIds: readonly string[];
}

export interface CharacterDefinition {
  id: string;
  displayName: string;
  description: string;
  category: CharacterCategory;
  visualTheme: string;
  silhouette: 'balanced' | 'angular' | 'heavy' | 'slender' | 'robotic';
  palettes: readonly CharacterPalette[];
  outfitVariantIds: readonly string[];
  headVariantIds: readonly string[];
  accessoryIds: readonly string[];
  defaultAppearance: Omit<CharacterAppearance, 'characterId'>;
  previewScale: number;
}

export interface CharacterVisual {
  root: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  weapon: THREE.Mesh;
  appearance: CharacterAppearance;
  animate: (deltaSeconds: number, movementSpeed: number, moving: boolean) => void;
  dispose: () => void;
}
