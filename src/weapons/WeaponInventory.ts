import type { WeaponDefinition } from './WeaponTypes';
import { WeaponRuntime } from './WeaponRuntime';

export class WeaponInventory {
  private readonly runtimes = new Map<string, WeaponRuntime>();
  private readonly weaponIds: string[];
  private activeWeaponId: string;

  public constructor(catalog: ReadonlyMap<string, WeaponDefinition>) {
    this.weaponIds = [...catalog.keys()];
    if (this.weaponIds.length === 0) {
      throw new Error('WeaponInventory requires at least one registered weapon.');
    }
    for (const definition of catalog.values()) {
      this.runtimes.set(definition.id, new WeaponRuntime(definition));
    }
    this.activeWeaponId = this.weaponIds[0];
  }

  public get active(): WeaponRuntime {
    return this.runtimes.get(this.activeWeaponId) as WeaponRuntime;
  }

  public get allWeaponIds(): readonly string[] {
    return this.weaponIds;
  }

  public getRuntime(weaponId: string): WeaponRuntime | null {
    return this.runtimes.get(weaponId) ?? null;
  }

  public select(weaponId: string): boolean {
    if (!this.runtimes.has(weaponId) || weaponId === this.activeWeaponId) {
      return false;
    }
    this.activeWeaponId = weaponId;
    return true;
  }

  public cycle(step = 1): boolean {
    const currentIndex = this.weaponIds.indexOf(this.activeWeaponId);
    const nextIndex = (currentIndex + step + this.weaponIds.length) % this.weaponIds.length;
    return this.select(this.weaponIds[nextIndex]);
  }

  public reset(): void {
    for (const runtime of this.runtimes.values()) {
      runtime.reset();
    }
    this.activeWeaponId = this.weaponIds[0];
  }

  public addReserveAmmo(amount: number, weaponIds = this.weaponIds): number {
    let added = 0;
    for (const weaponId of weaponIds) {
      added += this.runtimes.get(weaponId)?.addReserveAmmo(amount) ?? 0;
    }
    return added;
  }
}
