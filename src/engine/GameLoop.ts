export interface GameLoopMetrics {
  fps: number;
  frameTimeMs: number;
  averageFrameTimeMs: number;
  simulationSteps: number;
  droppedTimeSeconds: number;
  lastDeltaSeconds: number;
  simulationTimeMs: number;
  renderTimeMs: number;
  frames: number;
}

export interface FrameScheduler {
  request(callback: (timestamp: number) => void): number;
  cancel(handle: number): void;
}

export interface GameLoopOptions {
  stepSeconds: number;
  maxFrameDeltaSeconds: number;
  maxSimulationStepsPerFrame: number;
  scheduler?: FrameScheduler;
  now?: () => number;
}

export type SimulationUpdate = (stepSeconds: number) => void;
export type RenderUpdate = (interpolation: number, metrics: GameLoopMetrics) => void;

const browserScheduler: FrameScheduler = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => window.cancelAnimationFrame(handle),
};

export class GameLoop {
  private readonly updateCallback: SimulationUpdate;
  private readonly renderCallback: RenderUpdate;
  private readonly options: GameLoopOptions;
  private readonly scheduler: FrameScheduler;
  private readonly now: () => number;
  private readonly frameTimes: number[] = [];
  private frameHandle: number | null = null;
  private running = false;
  private suspended = false;
  private simulationEnabled = true;
  private lastTimestamp: number | null = null;
  private accumulator = 0;
  private metrics: GameLoopMetrics = {
    fps: 0,
    frameTimeMs: 0,
    averageFrameTimeMs: 0,
    simulationSteps: 0,
    droppedTimeSeconds: 0,
    lastDeltaSeconds: 0,
    simulationTimeMs: 0,
    renderTimeMs: 0,
    frames: 0,
  };

  public constructor(
    updateCallback: SimulationUpdate,
    renderCallback: RenderUpdate,
    options: GameLoopOptions,
  ) {
    if (!Number.isFinite(options.stepSeconds) || options.stepSeconds <= 0) {
      throw new Error('GameLoop stepSeconds must be finite and greater than zero.');
    }
    if (!Number.isFinite(options.maxFrameDeltaSeconds) || options.maxFrameDeltaSeconds <= 0) {
      throw new Error('GameLoop maxFrameDeltaSeconds must be finite and greater than zero.');
    }
    if (!Number.isInteger(options.maxSimulationStepsPerFrame) || options.maxSimulationStepsPerFrame <= 0) {
      throw new Error('GameLoop maxSimulationStepsPerFrame must be a positive integer.');
    }

    this.updateCallback = updateCallback;
    this.renderCallback = renderCallback;
    this.options = options;
    this.scheduler = options.scheduler ?? browserScheduler;
    this.now = options.now ?? (() => performance.now());
  }

  public get isRunning(): boolean {
    return this.running;
  }

  public getMetrics(): GameLoopMetrics {
    return { ...this.metrics };
  }

  public setSimulationEnabled(enabled: boolean): void {
    this.simulationEnabled = enabled;
    if (!enabled) {
      this.accumulator = 0;
    }
  }

  public setSuspended(suspended: boolean): void {
    this.suspended = suspended;
    this.lastTimestamp = null;
    this.accumulator = 0;
  }

  public start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.lastTimestamp = null;
    this.scheduleNextFrame();
  }

  public stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    if (this.frameHandle !== null) {
      this.scheduler.cancel(this.frameHandle);
      this.frameHandle = null;
    }
    this.lastTimestamp = null;
    this.accumulator = 0;
  }

  public dispose(): void {
    this.stop();
    this.frameTimes.length = 0;
  }

  private scheduleNextFrame(): void {
    if (this.running && this.frameHandle === null) {
      this.frameHandle = this.scheduler.request((timestamp) => this.handleFrame(timestamp));
    }
  }

  private handleFrame(timestamp: number): void {
    this.frameHandle = null;
    if (!this.running) {
      return;
    }

    if (this.suspended) {
      this.lastTimestamp = timestamp;
      this.scheduleNextFrame();
      return;
    }

    const frameStart = this.now();
    const rawDelta = this.lastTimestamp === null ? 0 : (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    const safeRawDelta = Number.isFinite(rawDelta) && rawDelta >= 0 ? rawDelta : 0;
    const deltaSeconds = Math.min(safeRawDelta, this.options.maxFrameDeltaSeconds);
    if (safeRawDelta > deltaSeconds) {
      this.metrics.droppedTimeSeconds += safeRawDelta - deltaSeconds;
    }

    this.metrics.lastDeltaSeconds = deltaSeconds;
    this.metrics.frameTimeMs = deltaSeconds * 1000;
    this.frameTimes.push(deltaSeconds);
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }
    const averageFrameTimeSeconds = this.frameTimes.length === 0
      ? 0
      : this.frameTimes.reduce((sum, value) => sum + value, 0) / this.frameTimes.length;
    this.metrics.averageFrameTimeMs = averageFrameTimeSeconds * 1000;
    this.metrics.fps = averageFrameTimeSeconds > 0 ? 1 / averageFrameTimeSeconds : 0;

    let simulationSteps = 0;
    const simulationStart = this.now();
    if (this.simulationEnabled) {
      this.accumulator += deltaSeconds;
      const maximumAccumulator = this.options.stepSeconds * this.options.maxSimulationStepsPerFrame;
      if (this.accumulator > maximumAccumulator) {
        this.metrics.droppedTimeSeconds += this.accumulator - maximumAccumulator;
        this.accumulator = maximumAccumulator;
      }

      while (
        this.accumulator >= this.options.stepSeconds
        && simulationSteps < this.options.maxSimulationStepsPerFrame
      ) {
        this.updateCallback(this.options.stepSeconds);
        this.accumulator -= this.options.stepSeconds;
        simulationSteps += 1;
      }
    }
    this.metrics.simulationSteps = simulationSteps;
    this.metrics.simulationTimeMs = this.now() - simulationStart;

    const interpolation = this.options.stepSeconds > 0
      ? this.accumulator / this.options.stepSeconds
      : 0;
    const renderStart = this.now();
    this.renderCallback(interpolation, this.getMetrics());
    this.metrics.renderTimeMs = this.now() - renderStart;
    this.metrics.frames += 1;
    this.metrics.frameTimeMs = Math.max(this.metrics.frameTimeMs, this.now() - frameStart);

    this.scheduleNextFrame();
  }
}
