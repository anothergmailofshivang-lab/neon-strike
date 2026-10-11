import type { DamageResult, DamageRequest } from './DamageTypes';
import type { WeaponDefinition, WeaponHudState } from '../weapons/WeaponTypes';

export type CombatEvent =
  | { type: 'weapon-fired'; weapon: WeaponDefinition; shotCount: number }
  | { type: 'shot-world-impact'; weapon: WeaponDefinition; point: { x: number; y: number; z: number } }
  | { type: 'damage-applied'; request: DamageRequest; result: DamageResult }
  | { type: 'critical-hit'; request: DamageRequest; result: DamageResult }
  | { type: 'target-defeated'; request: DamageRequest; result: DamageResult }
  | { type: 'weapon-reloaded'; weaponId: string }
  | { type: 'weapon-empty'; weaponId: string }
  | { type: 'weapon-equipped'; weapon: WeaponDefinition }
  | { type: 'weapon-switch-complete'; weapon: WeaponDefinition }
  | { type: 'ammo-collected'; amount: number; weaponIds: readonly string[] }
  | { type: 'weapon-status'; status: WeaponHudState };

export type CombatEventListener = (event: CombatEvent) => void;

export class CombatEventBus {
  private readonly listeners = new Set<CombatEventListener>();

  public subscribe(listener: CombatEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public emit(event: CombatEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}
