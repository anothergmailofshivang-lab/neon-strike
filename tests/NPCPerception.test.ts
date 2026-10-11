import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../src/physics/CollisionWorld';
import { NPCMemory } from '../src/ai/NPCMemory';
import { NPCPerception } from '../src/ai/NPCPerception';

describe('NPC perception', () => {
  it('requires both field of view and unobstructed static line of sight', async () => {
    const profile = { sightRange: 20, fieldOfView: Math.PI / 2, reactionDelay: 0.2 };
    const observer = new THREE.Vector3(0, 0, 0);
    const target = new THREE.Vector3(0, 1, -5);
    const openWorld = await CollisionWorld.create([]);
    const openMemory = new NPCMemory();
    const perception = new NPCPerception(openWorld, profile);

    expect(perception.observe(observer, 0, target, openMemory, 1, 4).visible).toBe(true);
    expect(openMemory.snapshot.confidence).toBe(1);
    openWorld.dispose();

    const blockedWorld = await CollisionWorld.create([
      { name: 'Wall', size: [10, 3, 0.4], position: [0, 1.5, -2] },
    ]);
    const blockedMemory = new NPCMemory();
    const blocked = new NPCPerception(blockedWorld, profile);
    expect(blocked.observe(observer, 0, target, blockedMemory, 1, 4).visible).toBe(false);
    expect(blockedMemory.snapshot.confidence).toBe(0);

    const outsideFov = blocked.observe(new THREE.Vector3(0, 0, 0), Math.PI, target, blockedMemory, 2, 4);
    expect(outsideFov.visible).toBe(false);
    blockedWorld.dispose();
  });
});
