import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CombatTargetRegistry, HitDetection } from '../src/combat/HitDetection';
import { CollisionWorld } from '../src/physics/CollisionWorld';
import { TargetDummy } from '../src/targets/TargetDummy';

describe('HitDetection', () => {
  it('resolves an unobstructed target and blocks a target behind world geometry', async () => {
    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
    camera.position.set(0, 1.6, 0);
    camera.lookAt(0, 1.6, -1);
    const target = new TargetDummy({ id: 'ray-target', position: [0, 0, -5], maxHealth: 100, respawnDelay: 3, accentColor: 0x00ffff });
    target.root.updateMatrixWorld(true);
    const registry = new CombatTargetRegistry();
    registry.register(target);

    const openWorld = await CollisionWorld.create([]);
    const openDetection = new HitDetection(camera, openWorld, registry);
    expect(openDetection.resolveCenterShot(null, 50).kind).toBe('target');
    openWorld.dispose();

    const blockedWorld = await CollisionWorld.create([
      { name: 'Wall', size: [10, 3, 0.4], position: [0, 1.5, -2] },
    ]);
    const blockedDetection = new HitDetection(camera, blockedWorld, registry);
    expect(blockedDetection.resolveCenterShot(null, 50).kind).toBe('world');
    blockedWorld.dispose();
    target.dispose();
  });
});
