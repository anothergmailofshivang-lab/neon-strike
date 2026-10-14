import type { EquipmentDefinition, EquipmentRuntimeSnapshot, EquipmentUseResult } from './EquipmentTypes';
import { validateEquipmentDefinition } from './EquipmentCatalog';

export class EquipmentRuntime {
  public readonly definition: EquipmentDefinition;
  private charges: number;
  private cooldownRemaining = 0;

  public constructor(definition: EquipmentDefinition) {
    this.definition = validateEquipmentDefinition(definition);
    this.charges = Math.min(definition.startingCharges, definition.maximumCharges);
  }

  public update(deltaSeconds: number): void {
    const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
    this.cooldownRemaining = Math.max(this.cooldownRemaining - delta, 0);
  }

  public tryConsume(): EquipmentUseResult {
    if (this.charges <= 0) return { accepted: false, reason: 'NO_CHARGES', snapshot: this.snapshot() };
    if (this.cooldownRemaining > 0) return { accepted: false, reason: 'COOLDOWN', snapshot: this.snapshot() };
    this.charges -= 1;
    this.cooldownRemaining = this.definition.cooldownSeconds;
    return { accepted: true, snapshot: this.snapshot() };
  }

  public addCharges(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const before = this.charges;
    this.charges = Math.min(this.charges + Math.floor(amount), this.definition.maximumCharges);
    return this.charges - before;
  }

  public reset(): void {
    this.charges = Math.min(this.definition.startingCharges, this.definition.maximumCharges);
    this.cooldownRemaining = 0;
  }

  public snapshot(): EquipmentRuntimeSnapshot {
    return {
      equipmentId: this.definition.id,
      charges: this.charges,
      cooldownRemaining: this.cooldownRemaining,
      ready: this.charges > 0 && this.cooldownRemaining <= 0,
    };
  }
}
