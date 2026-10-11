import { describe, expect, it } from 'vitest';
import { PointerLockManager, type PointerLockDocument } from '../src/player/PointerLockManager';

class FakeDocument implements PointerLockDocument {
  public pointerLockElement: Element | null = null;
  private readonly listeners = new Map<string, Set<EventListener>>();
  private element: Element | null = null;

  public setElement(element: Element): void {
    this.element = element;
  }

  public addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  public removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  public exitPointerLock(): void {
    this.pointerLockElement = null;
    this.dispatch('pointerlockchange');
  }

  public lock(): void {
    this.pointerLockElement = this.element;
    this.dispatch('pointerlockchange');
  }

  private dispatch(type: string): void {
    const event = new Event(type);
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe('PointerLockManager', () => {
  it('reports confirmed lock changes and exits cleanly', () => {
    const documentTarget = new FakeDocument();
    const element = { requestPointerLock: () => documentTarget.lock() } as unknown as HTMLElement;
    documentTarget.setElement(element);
    const changes: boolean[] = [];
    const manager = new PointerLockManager(element, documentTarget, (locked) => changes.push(locked), () => {});

    expect(manager.request()).toBe(true);
    expect(manager.isLocked).toBe(true);
    manager.exit();
    expect(manager.isLocked).toBe(false);
    expect(changes).toEqual([true, false]);
    manager.dispose();
  });

  it('does not request again after disposal', () => {
    const documentTarget = new FakeDocument();
    let requestCount = 0;
    const element = {
      requestPointerLock: () => { requestCount += 1; },
    } as unknown as HTMLElement;
    const manager = new PointerLockManager(element, documentTarget, () => {}, () => {});
    manager.dispose();
    expect(manager.request()).toBe(false);
    expect(requestCount).toBe(0);
  });
});
