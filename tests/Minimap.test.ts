import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { playerArrowRotation, worldToMinimap } from '../src/ui/Minimap';

describe('minimap projection', () => {
  it('projects the active map center and bounds into the minimap square', () => {
    expect(worldToMinimap(new THREE.Vector3(0, 0, 0), [60, 50])).toEqual([104, 104]);
    expect(worldToMinimap(new THREE.Vector3(-30, 0, -25), [60, 50])).toEqual([13, 13]);
    expect(worldToMinimap(new THREE.Vector3(30, 0, 25), [60, 50])).toEqual([195, 195]);
  });

  it('keeps the minimap arrow aligned with the Three.js local -Z forward basis', () => {
    expect(playerArrowRotation(0)).toBeCloseTo(0);
    expect(playerArrowRotation(Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
    expect(Math.abs(playerArrowRotation(Math.PI))).toBeCloseTo(Math.PI);
  });
});
