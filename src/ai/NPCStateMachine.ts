import { NPCState, type NPCStateTransition } from './NPCState';

export type NPCStateListener = (transition: NPCStateTransition) => void;

export class NPCStateMachine {
  private currentState: NPCState;
  private readonly listeners = new Set<NPCStateListener>();
  private enteredAt = 0;
  private lastTransition: NPCStateTransition | null = null;

  public constructor(initialState = NPCState.IDLE) {
    this.currentState = initialState;
  }

  public get state(): NPCState {
    return this.currentState;
  }

  public get timeInState(): number {
    return this.enteredAt;
  }

  public get transition(): NPCStateTransition | null {
    return this.lastTransition;
  }

  public transitionTo(next: NPCState, reason: string, time: number): boolean {
    if (next === this.currentState) {
      return false;
    }
    const transition: NPCStateTransition = {
      previous: this.currentState,
      next,
      reason,
      time,
    };
    this.currentState = next;
    this.enteredAt = time;
    this.lastTransition = transition;
    for (const listener of this.listeners) {
      listener(transition);
    }
    return true;
  }

  public subscribe(listener: NPCStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public reset(time = 0): void {
    this.currentState = NPCState.IDLE;
    this.enteredAt = time;
    this.lastTransition = null;
  }
}
