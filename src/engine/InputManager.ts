export interface InputEventTarget {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

function getDefaultKeyboardTarget(): InputEventTarget {
  if (typeof window === 'undefined') {
    throw new Error('InputManager requires a browser event target when window is unavailable.');
  }
  return window;
}

function getDefaultVisibilityTarget(): InputEventTarget {
  if (typeof document === 'undefined') {
    throw new Error('InputManager requires a browser document when document is unavailable.');
  }
  return document;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

export class InputManager {
  private readonly keyboardTarget: InputEventTarget;
  private readonly focusTarget: InputEventTarget;
  private readonly visibilityTarget: InputEventTarget;
  private readonly mouseTarget: InputEventTarget;
  private readonly heldKeys = new Set<string>();
  private readonly pressedKeys = new Set<string>();
  private readonly pendingPressedKeys = new Set<string>();
  private readonly releasedKeys = new Set<string>();
  private readonly heldMouseButtons = new Set<number>();
  private readonly pressedMouseButtons = new Set<number>();
  private readonly pendingPressedMouseButtons = new Set<number>();
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private mouseWheelDelta = 0;
  private active = false;

  private readonly handleKeyDownEvent = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.code || isEditableTarget(keyboardEvent.target)) {
      return;
    }

    if (!this.heldKeys.has(keyboardEvent.code)) {
      this.pressedKeys.add(keyboardEvent.code);
      this.pendingPressedKeys.add(keyboardEvent.code);
    }
    this.heldKeys.add(keyboardEvent.code);
  };

  private readonly handleKeyUpEvent = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.code) {
      return;
    }

    if (this.heldKeys.delete(keyboardEvent.code)) {
      this.releasedKeys.add(keyboardEvent.code);
    }
  };

  private readonly handleMouseMoveEvent = (event: Event): void => {
    const mouseEvent = event as MouseEvent;
    if (Number.isFinite(mouseEvent.movementX) && Number.isFinite(mouseEvent.movementY)) {
      this.mouseDeltaX += mouseEvent.movementX;
      this.mouseDeltaY += mouseEvent.movementY;
    }
  };

  private readonly handleMouseDownEvent = (event: Event): void => {
    const mouseEvent = event as MouseEvent;
    if (!this.heldMouseButtons.has(mouseEvent.button)) {
      this.pressedMouseButtons.add(mouseEvent.button);
      this.pendingPressedMouseButtons.add(mouseEvent.button);
    }
    this.heldMouseButtons.add(mouseEvent.button);
  };

  private readonly handleMouseUpEvent = (event: Event): void => {
    this.heldMouseButtons.delete((event as MouseEvent).button);
  };

  private readonly handleWheelEvent = (event: Event): void => {
    const wheelEvent = event as WheelEvent;
    if (Number.isFinite(wheelEvent.deltaY)) {
      this.mouseWheelDelta += wheelEvent.deltaY;
    }
  };

  private readonly resetFromFocusLoss = (): void => {
    this.reset();
  };

  public constructor(
    keyboardTarget: InputEventTarget = getDefaultKeyboardTarget(),
    focusTarget: InputEventTarget = keyboardTarget,
    visibilityTarget: InputEventTarget = getDefaultVisibilityTarget(),
    mouseTarget: InputEventTarget = visibilityTarget,
  ) {
    this.keyboardTarget = keyboardTarget;
    this.focusTarget = focusTarget;
    this.visibilityTarget = visibilityTarget;
    this.mouseTarget = mouseTarget;
    this.keyboardTarget.addEventListener('keydown', this.handleKeyDownEvent as EventListener);
    this.keyboardTarget.addEventListener('keyup', this.handleKeyUpEvent as EventListener);
    this.focusTarget.addEventListener('blur', this.resetFromFocusLoss as EventListener);
    this.visibilityTarget.addEventListener('visibilitychange', this.resetFromFocusLoss as EventListener);
    this.mouseTarget.addEventListener('mousemove', this.handleMouseMoveEvent as EventListener);
    this.mouseTarget.addEventListener('mousedown', this.handleMouseDownEvent as EventListener);
    this.mouseTarget.addEventListener('mouseup', this.handleMouseUpEvent as EventListener);
    this.mouseTarget.addEventListener('wheel', this.handleWheelEvent as EventListener);
    this.active = true;
  }

  public get isActive(): boolean {
    return this.active;
  }

  public isHeld(code: string): boolean {
    return this.heldKeys.has(code);
  }

  public wasPressed(code: string): boolean {
    return this.pressedKeys.has(code);
  }

  public wasReleased(code: string): boolean {
    return this.releasedKeys.has(code);
  }

  /**
   * Consumes a discrete action without losing it when a render frame occurs
   * before the next fixed simulation step.
   */
  public consumePressed(code: string): boolean {
    const pressed = this.pendingPressedKeys.delete(code);
    this.pressedKeys.delete(code);
    return pressed;
  }

  public getHeldKeys(): readonly string[] {
    return [...this.heldKeys];
  }

  public consumeMouseDelta(): { x: number; y: number } {
    const delta = { x: this.mouseDeltaX, y: this.mouseDeltaY };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }

  public isMouseHeld(button: number): boolean {
    return this.heldMouseButtons.has(button);
  }

  public wasMousePressed(button: number): boolean {
    return this.pressedMouseButtons.has(button);
  }

  public consumeMousePressed(button: number): boolean {
    const pressed = this.pendingPressedMouseButtons.delete(button);
    this.pressedMouseButtons.delete(button);
    return pressed;
  }

  public consumeMouseWheelDirection(): number {
    const direction = this.mouseWheelDelta === 0 ? 0 : Math.sign(this.mouseWheelDelta);
    this.mouseWheelDelta = 0;
    return direction;
  }

  public endFrame(): void {
    this.pressedKeys.clear();
    this.releasedKeys.clear();
    this.pressedMouseButtons.clear();
  }

  public reset(): void {
    this.heldKeys.clear();
    this.pressedKeys.clear();
    this.pendingPressedKeys.clear();
    this.releasedKeys.clear();
    this.heldMouseButtons.clear();
    this.pressedMouseButtons.clear();
    this.pendingPressedMouseButtons.clear();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.mouseWheelDelta = 0;
  }

  public dispose(): void {
    if (!this.active) {
      return;
    }

    this.active = false;
    this.keyboardTarget.removeEventListener('keydown', this.handleKeyDownEvent as EventListener);
    this.keyboardTarget.removeEventListener('keyup', this.handleKeyUpEvent as EventListener);
    this.focusTarget.removeEventListener('blur', this.resetFromFocusLoss as EventListener);
    this.visibilityTarget.removeEventListener('visibilitychange', this.resetFromFocusLoss as EventListener);
    this.mouseTarget.removeEventListener('mousemove', this.handleMouseMoveEvent as EventListener);
    this.mouseTarget.removeEventListener('mousedown', this.handleMouseDownEvent as EventListener);
    this.mouseTarget.removeEventListener('mouseup', this.handleMouseUpEvent as EventListener);
    this.mouseTarget.removeEventListener('wheel', this.handleWheelEvent as EventListener);
    this.reset();
  }
}
