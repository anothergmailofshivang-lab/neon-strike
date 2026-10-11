import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { InputManager, type InputEventTarget } from '../src/engine/InputManager';
import { createPlayerConfig } from '../src/player/PlayerConfig';
import { PlayerLook } from '../src/player/PlayerLook';

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

  public mouse(movementX: number, movementY: number): void {
    const event = new Event('mousemove');
    Object.defineProperty(event, 'movementX', { value: movementX });
    Object.defineProperty(event, 'movementY', { value: movementY });
    for (const listener of this.listeners.get('mousemove') ?? []) {
      listener(event);
    }
  }
}

describe('PlayerLook', () => {
  it('converts mouse deltas into yaw and pitch and clamps pitch', () => {
    const target = new FakeEventTarget();
    const input = new InputManager(target, target, target, target);
    const yawObject = new THREE.Object3D();
    const pitchObject = new THREE.Object3D();
    const config = createPlayerConfig().look;
    const look = new PlayerLook(input, yawObject, pitchObject, config);

    target.mouse(100, -100);
    look.update(true);

    expect(look.getYaw()).toBeCloseTo(-0.22);
    expect(look.getPitch()).toBeCloseTo(0.22);
    expect(yawObject.rotation.y).toBeCloseTo(look.getYaw());
    expect(pitchObject.rotation.x).toBeCloseTo(look.getPitch());

    target.mouse(0, -10000);
    look.update(true);
    expect(look.getPitch()).toBe(config.maximumPitch);
    input.dispose();
  });

  it('does not rotate while inactive and resets orientation', () => {
    const target = new FakeEventTarget();
    const input = new InputManager(target, target, target, target);
    const look = new PlayerLook(input, new THREE.Object3D(), new THREE.Object3D(), createPlayerConfig().look);

    target.mouse(50, 20);
    look.update(false);
    expect(look.getYaw()).toBe(0);
    expect(look.getPitch()).toBe(0);
    look.reset(Math.PI / 2, 0.2);
    expect(look.getYaw()).toBeCloseTo(Math.PI / 2);
    input.dispose();
  });
});
