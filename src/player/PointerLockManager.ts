export type PointerLockChangeListener = (locked: boolean) => void;
export type PointerLockErrorListener = (error: Error) => void;

export interface PointerLockDocument {
  pointerLockElement: Element | null;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  exitPointerLock(): void;
}

type PointerLockElement = HTMLElement;

export class PointerLockManager {
  private readonly element: PointerLockElement;
  private readonly documentTarget: PointerLockDocument;
  private readonly onChange: PointerLockChangeListener;
  private readonly onError: PointerLockErrorListener;
  private disposed = false;

  private readonly handleChange = (): void => {
    this.onChange(this.isLocked);
  };

  private readonly handleError = (): void => {
    this.onError(new Error('The browser rejected pointer lock for the gameplay canvas.'));
  };

  public constructor(
    element: HTMLElement,
    documentTarget: PointerLockDocument,
    onChange: PointerLockChangeListener,
    onError: PointerLockErrorListener,
  ) {
    this.element = element as PointerLockElement;
    this.documentTarget = documentTarget;
    this.onChange = onChange;
    this.onError = onError;
    this.documentTarget.addEventListener('pointerlockchange', this.handleChange as EventListener);
    this.documentTarget.addEventListener('pointerlockerror', this.handleError as EventListener);
  }

  public get isLocked(): boolean {
    return this.documentTarget.pointerLockElement === this.element;
  }

  public request(): boolean {
    if (this.disposed || this.isLocked) {
      if (this.isLocked) {
        this.onChange(true);
      }
      return !this.disposed;
    }

    try {
      const requestPointerLock = this.element.requestPointerLock as unknown as () => void | Promise<void>;
      const result = requestPointerLock.call(this.element);
      if (result && typeof result.then === 'function') {
        void result.catch((error: unknown) => {
          this.onError(error instanceof Error ? error : new Error(String(error)));
        });
      }
      return true;
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  public exit(): void {
    if (!this.disposed && this.isLocked) {
      this.documentTarget.exitPointerLock();
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.documentTarget.removeEventListener('pointerlockchange', this.handleChange as EventListener);
    this.documentTarget.removeEventListener('pointerlockerror', this.handleError as EventListener);
    if (this.isLocked) {
      this.documentTarget.exitPointerLock();
    }
  }
}
