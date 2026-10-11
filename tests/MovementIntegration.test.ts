import { describe, expect, it } from 'vitest';
import { InputManager, type InputEventTarget } from '../src/engine/InputManager';
import { CollisionWorld } from '../src/physics/CollisionWorld';
import { createPlayerConfig } from '../src/player/PlayerConfig';
import { PlayerMotor } from '../src/player/PlayerMotor';
import { PlayerMovementState } from '../src/player/PlayerState';

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

  public key(type: string, code: string): void {
    const event = new Event(type);
    Object.defineProperty(event, 'code', { value: code });
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe('PlayerMotor and Rapier collision integration', () => {
  it('lands, jumps once, and stops at a solid wall', async () => {
    const collision = await CollisionWorld.create([
      { name: 'Floor', size: [30, 0.2, 30], position: [0, -0.1, 0] },
      { name: 'Wall', size: [8, 3, 0.5], position: [0, 1.5, -3] },
    ]);
    const config = createPlayerConfig();
    config.spawnPosition = [0, 0, 0];
    const target = new FakeEventTarget();
    const input = new InputManager(target, target, target, target);
    const motor = new PlayerMotor(collision, config);
    motor.setActive(true);

    for (let index = 0; index < 5; index += 1) {
      motor.update(1 / 60, 0, input);
      input.endFrame();
    }
    expect(motor.isGrounded()).toBe(true);

    target.key('keydown', 'Space');
    const jump = motor.update(1 / 60, 0, input);
    expect(jump.reset).toBe(false);
    expect(motor.getVelocity().y).toBeGreaterThan(0);
    input.endFrame();

    let risingTransitions = 0;
    let previousState = motor.getMovementState();
    target.key('keydown', 'Space');
    for (let index = 0; index < 120; index += 1) {
      motor.update(1 / 60, 0, input);
      const currentState = motor.getMovementState();
      if (previousState !== PlayerMovementState.RISING && currentState === PlayerMovementState.RISING) {
        risingTransitions += 1;
      }
      previousState = currentState;
      input.endFrame();
    }
    expect(risingTransitions).toBe(0);
    expect(motor.isGrounded()).toBe(true);

    target.key('keydown', 'KeyW');
    target.key('keydown', 'KeyD');
    for (let index = 0; index < 120; index += 1) {
      motor.update(1 / 60, 0, input);
      input.endFrame();
    }
    expect(motor.getPosition().z).toBeGreaterThan(-2.7);
    expect(motor.getPosition().x).toBeGreaterThan(0.5);
    expect(motor.getCollisionCount()).toBeGreaterThan(0);

    input.dispose();
    collision.dispose();
  });
});
