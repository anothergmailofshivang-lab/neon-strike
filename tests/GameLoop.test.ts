import { describe, expect, it } from 'vitest';
import { GameLoop, type FrameScheduler } from '../src/engine/GameLoop';

class FakeScheduler implements FrameScheduler {
  private nextHandle = 1;
  private readonly callbacks = new Map<number, (timestamp: number) => void>();

  public request(callback: (timestamp: number) => void): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }

  public cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  public step(timestamp: number): void {
    const entry = this.callbacks.entries().next().value as [number, (timestamp: number) => void] | undefined;
    if (!entry) {
      return;
    }
    this.callbacks.delete(entry[0]);
    entry[1](timestamp);
  }

  public get pendingCount(): number {
    return this.callbacks.size;
  }
}

describe('GameLoop', () => {
  it('prevents duplicate schedules, clamps spikes, and stops cleanly', () => {
    const scheduler = new FakeScheduler();
    let updates = 0;
    let renders = 0;
    const loop = new GameLoop(
      () => { updates += 1; },
      () => { renders += 1; },
      {
        stepSeconds: 1 / 60,
        maxFrameDeltaSeconds: 0.1,
        maxSimulationStepsPerFrame: 3,
        scheduler,
        now: () => 0,
      },
    );

    loop.start();
    loop.start();
    expect(scheduler.pendingCount).toBe(1);
    scheduler.step(0);
    scheduler.step(1000);
    expect(updates).toBe(3);
    expect(renders).toBe(2);
    expect(loop.getMetrics().droppedTimeSeconds).toBeGreaterThan(0);

    loop.stop();
    expect(scheduler.pendingCount).toBe(0);
    scheduler.step(1100);
    expect(renders).toBe(2);
  });

  it('does not simulate while disabled and resumes without a backlog', () => {
    const scheduler = new FakeScheduler();
    let updates = 0;
    const loop = new GameLoop(
      () => { updates += 1; },
      () => {},
      {
        stepSeconds: 0.1,
        maxFrameDeltaSeconds: 0.5,
        maxSimulationStepsPerFrame: 5,
        scheduler,
        now: () => 0,
      },
    );

    loop.setSimulationEnabled(false);
    loop.start();
    scheduler.step(0);
    scheduler.step(1000);
    expect(updates).toBe(0);
    loop.setSimulationEnabled(true);
    scheduler.step(1010);
    expect(updates).toBe(0);
    scheduler.step(1110);
    expect(updates).toBe(1);
  });
});
