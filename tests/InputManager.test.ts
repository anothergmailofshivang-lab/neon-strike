import { describe, expect, it } from 'vitest';
import { InputManager, type InputEventTarget } from '../src/engine/InputManager';

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

  public dispatch(type: string, code = '', repeat = false): void {
    const event = new Event(type);
    Object.defineProperty(event, 'code', { value: code });
    Object.defineProperty(event, 'repeat', { value: repeat });
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  public dispatchMouse(movementX: number, movementY: number): void {
    const event = new Event('mousemove');
    Object.defineProperty(event, 'movementX', { value: movementX });
    Object.defineProperty(event, 'movementY', { value: movementY });
    for (const listener of this.listeners.get('mousemove') ?? []) {
      listener(event);
    }
  }
}

describe('InputManager', () => {
  it('consumes tactical/utility/interact presses once and rejects auto-repeat after focus loss', () => {
    const target = new FakeEventTarget();
    const input = new InputManager(target, target, target);
    for (const key of ['KeyG', 'KeyH', 'KeyE']) {
      target.dispatch('keydown', key);
      expect(input.consumePressed(key)).toBe(true);
      target.dispatch('keydown', key, true);
      expect(input.consumePressed(key)).toBe(false);
      target.dispatch('blur'); target.dispatch('keydown', key, true);
      expect(input.consumePressed(key)).toBe(false);
      target.dispatch('keyup', key);
    }
    input.dispose();
  });
  it('tracks held, pressed, and released keyboard state', () => {
    const target = new FakeEventTarget();
    const input = new InputManager(target, target, target);

    target.dispatch('keydown', 'KeyW');
    expect(input.isHeld('KeyW')).toBe(true);
    expect(input.wasPressed('KeyW')).toBe(true);

    target.dispatch('keydown', 'KeyW');
    expect(input.wasPressed('KeyW')).toBe(true);
    input.endFrame();
    expect(input.wasPressed('KeyW')).toBe(false);
    expect(input.consumePressed('KeyW')).toBe(true);
    expect(input.consumePressed('KeyW')).toBe(false);
    expect(input.isHeld('KeyW')).toBe(true);

    target.dispatch('keyup', 'KeyW');
    expect(input.isHeld('KeyW')).toBe(false);
    expect(input.wasReleased('KeyW')).toBe(true);
    input.dispose();
  });

  it('clears keys on focus loss and removes listeners on disposal', () => {
    const target = new FakeEventTarget();
    const input = new InputManager(target, target, target);

    target.dispatch('keydown', 'Space');
    target.dispatch('blur');
    expect(input.isHeld('Space')).toBe(false);

    input.dispose();
    target.dispatch('keydown', 'KeyA');
    expect(input.isHeld('KeyA')).toBe(false);
  });

  it('accumulates mouse deltas until a look controller consumes them', () => {
    const target = new FakeEventTarget();
    const input = new InputManager(target, target, target, target);

    target.dispatchMouse(12, -4);
    expect(input.consumeMouseDelta()).toEqual({ x: 12, y: -4 });
    expect(input.consumeMouseDelta()).toEqual({ x: 0, y: 0 });
    input.dispose();
  });

  it('maps logical actions and clears them when disabled', () => {
    const target = new FakeEventTarget();
    const input = new InputManager(target, target, target, target);
    input.setBindings({
      moveForward: 'KeyI', moveBackward: 'KeyK', moveLeft: 'KeyJ', moveRight: 'KeyL', jump: 'Space', sprint: 'ShiftLeft', reload: 'KeyR', primaryWeapon: 'Digit1', secondaryWeapon: 'Digit2', nextWeapon: 'KeyQ', tactical: 'KeyG', utility: 'KeyH', interact: 'KeyF', pause: 'Escape', scoreboard: 'Tab',
    });
    target.dispatch('keydown', 'KeyI');
    expect(input.isActionHeld('moveForward')).toBe(true);
    expect(input.consumeActionPressed('moveForward')).toBe(true);
    input.setEnabled(false);
    expect(input.isActionHeld('moveForward')).toBe(false);
    input.dispose();
  });
});
