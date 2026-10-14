export type TacticalEvent =
  | { type: 'equipment-used'; ownerId: string; equipmentId: string; slot: 'tactical' | 'utility' }
  | { type: 'equipment-effect'; ownerId: string; equipmentId: string; effect: 'damage' | 'smoke' | 'flash' | 'heal' | 'ammo' | 'sensor'; amount: number }
  | { type: 'pickup-collected'; pickupId: string; pickupType: string; amount: number };

export type TacticalEventListener = (event: TacticalEvent) => void;

export class TacticalEventBus {
  private readonly listeners = new Set<TacticalEventListener>();
  public subscribe(listener: TacticalEventListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  public emit(event: TacticalEvent): void { for (const listener of this.listeners) listener(event); }
  public clear(): void { this.listeners.clear(); }
}
