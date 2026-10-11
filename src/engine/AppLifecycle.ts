export interface LifecycleTarget {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

export interface AppLifecycleCallbacks {
  onVisibilityChanged: (visible: boolean) => void;
  onFocusLost?: () => void;
}

export class AppLifecycle {
  private readonly documentTarget: LifecycleTarget;
  private readonly windowTarget: LifecycleTarget;
  private readonly callbacks: AppLifecycleCallbacks;
  private active = false;

  private readonly visibilityHandler = (): void => {
    const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
    this.callbacks.onVisibilityChanged(visible);
  };

  private readonly blurHandler = (): void => {
    this.callbacks.onFocusLost?.();
  };

  public constructor(
    documentTarget: LifecycleTarget,
    windowTarget: LifecycleTarget,
    callbacks: AppLifecycleCallbacks,
  ) {
    this.documentTarget = documentTarget;
    this.windowTarget = windowTarget;
    this.callbacks = callbacks;
  }

  public start(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    this.documentTarget.addEventListener('visibilitychange', this.visibilityHandler as EventListener);
    this.windowTarget.addEventListener('blur', this.blurHandler as EventListener);
  }

  public dispose(): void {
    if (!this.active) {
      return;
    }
    this.active = false;
    this.documentTarget.removeEventListener('visibilitychange', this.visibilityHandler as EventListener);
    this.windowTarget.removeEventListener('blur', this.blurHandler as EventListener);
  }
}
