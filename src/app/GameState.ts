export enum ApplicationState {
  INITIALIZING = 'INITIALIZING',
  MAIN_MENU = 'MAIN_MENU',
  LOADING_MATCH = 'LOADING_MATCH',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  MATCH_RESULTS = 'MATCH_RESULTS',
  ERROR = 'ERROR',
}

export type StateChangeListener = (
  previousState: ApplicationState,
  nextState: ApplicationState,
) => void;

const LEGAL_TRANSITIONS: Readonly<Record<ApplicationState, ReadonlySet<ApplicationState>>> = {
  [ApplicationState.INITIALIZING]: new Set([
    ApplicationState.MAIN_MENU,
    ApplicationState.ERROR,
  ]),
  [ApplicationState.MAIN_MENU]: new Set([ApplicationState.LOADING_MATCH]),
  [ApplicationState.LOADING_MATCH]: new Set([
    ApplicationState.PLAYING,
    ApplicationState.MAIN_MENU,
    ApplicationState.ERROR,
  ]),
  [ApplicationState.PLAYING]: new Set([
    ApplicationState.PAUSED,
    ApplicationState.MAIN_MENU,
    ApplicationState.MATCH_RESULTS,
  ]),
  [ApplicationState.PAUSED]: new Set([
    ApplicationState.PLAYING,
    ApplicationState.MAIN_MENU,
  ]),
  [ApplicationState.MATCH_RESULTS]: new Set([
    ApplicationState.MAIN_MENU,
    ApplicationState.LOADING_MATCH,
  ]),
  [ApplicationState.ERROR]: new Set(),
};

export class GameStateMachine {
  private currentState: ApplicationState;
  private readonly listeners = new Set<StateChangeListener>();

  public constructor(initialState = ApplicationState.INITIALIZING) {
    this.currentState = initialState;
  }

  public get state(): ApplicationState {
    return this.currentState;
  }

  public canTransitionTo(nextState: ApplicationState): boolean {
    return LEGAL_TRANSITIONS[this.currentState].has(nextState);
  }

  public transitionTo(nextState: ApplicationState): boolean {
    if (nextState === this.currentState || !this.canTransitionTo(nextState)) {
      return false;
    }

    const previousState = this.currentState;
    this.currentState = nextState;
    for (const listener of this.listeners) {
      listener(previousState, nextState);
    }
    return true;
  }

  public subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
