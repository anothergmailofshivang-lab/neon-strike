import type { PlayerSnapshot } from '../player/PlayerState';
import type { WeaponHudState } from '../weapons/WeaponTypes';
import * as THREE from 'three';

export interface TutorialSignals {
  player: PlayerSnapshot;
  weapon: WeaponHudState;
  actionPressed: (action: TutorialAction) => boolean;
  fired: boolean;
  reloaded: boolean;
  switchedWeapon: boolean;
  equipmentUsed: boolean;
  interacted: boolean;
}

export type TutorialAction = 'moveForward' | 'moveBackward' | 'moveLeft' | 'moveRight' | 'jump' | 'sprint' | 'reload' | 'primaryWeapon' | 'secondaryWeapon' | 'tactical' | 'utility' | 'interact';

export interface TutorialStepDefinition {
  id: string;
  title: string;
  instruction: string;
  hint?: string;
  isComplete: (signals: TutorialSignals, runtime: TutorialRuntime) => boolean;
}

export const TUTORIAL_STEPS: readonly TutorialStepDefinition[] = [
  { id: 'look', title: 'LOOK AROUND', instruction: 'Move the mouse to rotate your view.', isComplete: (s, r) => Math.abs(s.player.yaw - r.startYaw) > 0.12 || Math.abs(s.player.pitch - r.startPitch) > 0.08 },
  { id: 'move', title: 'MOVE', instruction: 'Use WASD to move relative to where you are facing.', isComplete: (s) => ['moveForward', 'moveBackward', 'moveLeft', 'moveRight'].some((a) => s.actionPressed(a as TutorialAction)) || s.player.horizontalSpeed > 0.5 },
  { id: 'turn-and-move', title: 'TURN AND MOVE', instruction: 'Turn to a new angle, then move. Direction follows your facing.', isComplete: (s, r) => r.hasTurned && s.player.horizontalSpeed > 0.5 && s.player.position.distanceTo(new THREE.Vector3(r.startPosition.x, r.startPosition.y, r.startPosition.z)) > 0.7 },
  { id: 'sprint-jump', title: 'SPRINT + JUMP', instruction: 'Hold Sprint while moving, then jump over the practice lane.', isComplete: (_s, r) => r.sprinted && r.jumped },
  { id: 'aim-fire', title: 'AIM + FIRE', instruction: 'Aim with the right mouse button and fire at a practice target.', isComplete: (_s, r) => r.aimed && r.fired },
  { id: 'reload-switch', title: 'RELOAD + SWITCH', instruction: 'Reload your weapon, then switch to the other weapon.', isComplete: (_s, r) => r.reloaded && r.switchedWeapon },
  { id: 'equipment', title: 'TACTICAL EQUIPMENT', instruction: 'Use the tactical equipment charge with the current binding.', isComplete: (_s, r) => r.equipmentUsed },
  { id: 'interact', title: 'INTERACT', instruction: 'Face a glowing console and interact with it.', isComplete: (_s, r) => r.interacted },
  { id: 'objective', title: 'FOLLOW A LOCATION', instruction: 'Reach the central training targets while watching your position on the minimap.', isComplete: (s) => s.player.position.distanceTo(new THREE.Vector3(0, 0, 5)) < 4 },
];

export class TutorialRuntime {
  public readonly startYaw: number;
  public readonly startPitch: number;
  public readonly startPosition: { x: number; y: number; z: number };
  public currentIndex = 0;
  public hasTurned = false;
  public sprinted = false;
  public jumped = false;
  public aimed = false;
  public fired = false;
  public reloaded = false;
  public switchedWeapon = false;
  public equipmentUsed = false;
  public interacted = false;
  public completed = false;

  public constructor(snapshot: PlayerSnapshot) {
    this.startYaw = snapshot.yaw; this.startPitch = snapshot.pitch;
    this.startPosition = { x: snapshot.position.x, y: snapshot.position.y, z: snapshot.position.z };
  }

  public get step(): TutorialStepDefinition | null { return TUTORIAL_STEPS[this.currentIndex] ?? null; }
  public get progress(): string { return `${Math.min(this.currentIndex + 1, TUTORIAL_STEPS.length)}/${TUTORIAL_STEPS.length}`; }
  public update(signals: TutorialSignals): boolean {
    if (this.completed) return false;
    if (Math.abs(signals.player.yaw - this.startYaw) > 0.45) this.hasTurned = true;
    if (signals.player.movementState === 'SPRINTING') this.sprinted = true;
    if (signals.actionPressed('jump') || signals.player.movementState === 'RISING') this.jumped = true;
    if (signals.weapon.aiming) this.aimed = true;
    this.fired ||= signals.fired; this.reloaded ||= signals.reloaded; this.switchedWeapon ||= signals.switchedWeapon;
    this.equipmentUsed ||= signals.equipmentUsed; this.interacted ||= signals.interacted;
    if (this.step?.isComplete(signals, this)) {
      this.currentIndex += 1;
      if (this.currentIndex >= TUTORIAL_STEPS.length) this.completed = true;
      return true;
    }
    return false;
  }
}
