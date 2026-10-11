import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CombatEventBus } from '../src/combat/CombatEvents';
import { DamageSystem } from '../src/combat/DamageSystem';
import { CombatTargetRegistry } from '../src/combat/HitDetection';
import { CollisionWorld } from '../src/physics/CollisionWorld';
import { TargetDummy } from '../src/targets/TargetDummy';
import { WeaponController } from '../src/weapons/WeaponController';
import { InputManager, type InputEventTarget } from '../src/engine/InputManager';
import { WeaponSkinRegistry } from '../src/cosmetics/WeaponSkinRegistry';
import { WEAPON_SKIN_DEFINITIONS } from '../src/cosmetics/WeaponSkinDefinitions';

class FakeEventTarget implements InputEventTarget {
  private readonly listeners = new Map<string, Set<EventListener>>();

  public addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  public removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  public dispatch(type: string, code = '', button = 0): void {
    const event = new Event(type);
    Object.defineProperty(event, 'code', { value: code });
    Object.defineProperty(event, 'button', { value: button });
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe('WeaponController', () => {
  it('fires a real weapon through target raycast and damage systems', async () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
    camera.position.set(0, 1.6, 0);
    camera.lookAt(0, 1.6, -1);
    camera.updateMatrixWorld(true);
    const target = new TargetDummy({ id: 'weapon-target', position: [0, 0, -5], maxHealth: 100, respawnDelay: 5, accentColor: 0x00ffff });
    target.root.updateMatrixWorld(true);
    const registry = new CombatTargetRegistry();
    registry.register(target);
    const events = new CombatEventBus();
    const damage = new DamageSystem(events);
    damage.register(target);
    const collision = await CollisionWorld.create([]);
    const inputTarget = new FakeEventTarget();
    const input = new InputManager(inputTarget, inputTarget, inputTarget, inputTarget);
    const controller = new WeaponController(
      scene,
      camera,
      input,
      collision,
      damage,
      registry,
      events,
      {
        onRecoil: () => {},
        onAimChanged: () => {},
        onHitFeedback: () => {},
        getPlayerMovement: () => ({ horizontalSpeed: 0 }),
      },
    );
    const skins = new WeaponSkinRegistry(WEAPON_SKIN_DEFINITIONS);
    expect(controller.applyLoadout({ primaryWeaponId: 'sniper-rifle', secondaryWeaponId: 'pistol', primarySkinId: 'arctic', secondarySkinId: 'standard' }, skins)).toBe(true);
    expect(controller.getLoadout().primaryWeaponId).toBe('sniper-rifle');
    expect(controller.getHudState().weaponId).toBe('sniper-rifle');
    expect(controller.applyLoadout({ primaryWeaponId: 'assault-rifle', secondaryWeaponId: 'pistol', primarySkinId: 'standard', secondarySkinId: 'standard' }, skins)).toBe(true);
    controller.setActive(true);

    inputTarget.dispatch('mousedown', '', 0);
    controller.update(1 / 60, true);
    input.endFrame();
    expect(controller.getHudState().magazineAmmo).toBe(29);
    expect(target.health).toBeLessThan(100);

    controller.dispose();
    input.dispose();
    collision.dispose();
    target.dispose();
  });
});
