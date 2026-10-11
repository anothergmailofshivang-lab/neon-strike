import { describe, expect, it } from 'vitest';
import { ApplicationState, GameStateMachine } from '../src/app/GameState';

describe('GameStateMachine', () => {
  it('starts in INITIALIZING and accepts the normal startup path', () => {
    const machine = new GameStateMachine();
    const transitions: string[] = [];
    machine.subscribe((from, to) => transitions.push(`${from}->${to}`));

    expect(machine.state).toBe(ApplicationState.INITIALIZING);
    expect(machine.transitionTo(ApplicationState.MAIN_MENU)).toBe(true);
    expect(machine.transitionTo(ApplicationState.LOADING_MATCH)).toBe(true);
    expect(machine.transitionTo(ApplicationState.PLAYING)).toBe(true);
    expect(transitions).toEqual([
      'INITIALIZING->MAIN_MENU',
      'MAIN_MENU->LOADING_MATCH',
      'LOADING_MATCH->PLAYING',
    ]);
  });

  it('rejects invalid transitions without changing state', () => {
    const machine = new GameStateMachine();

    expect(machine.transitionTo(ApplicationState.PLAYING)).toBe(false);
    expect(machine.state).toBe(ApplicationState.INITIALIZING);
    expect(machine.canTransitionTo(ApplicationState.PLAYING)).toBe(false);
  });

  it('supports pause, resume, and returning to the menu', () => {
    const machine = new GameStateMachine(ApplicationState.PLAYING);

    expect(machine.transitionTo(ApplicationState.PAUSED)).toBe(true);
    expect(machine.transitionTo(ApplicationState.PLAYING)).toBe(true);
    expect(machine.transitionTo(ApplicationState.MAIN_MENU)).toBe(true);
    expect(machine.state).toBe(ApplicationState.MAIN_MENU);
  });
});
