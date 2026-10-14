import type { WeaponDefinition } from './WeaponTypes';
import { WeaponRuntime } from './WeaponRuntime';
import type { PlayerLoadout } from '../loadouts/LoadoutTypes';

export class WeaponInventory {
  private readonly runtimes = new Map<string, WeaponRuntime>();
  private readonly weaponIds: string[];
  private activeWeaponId: string;
  private primaryWeaponId: string;
  private secondaryWeaponId: string;

  public constructor(catalog: ReadonlyMap<string, WeaponDefinition>) {
    this.weaponIds = [...catalog.keys()];
    if (this.weaponIds.length === 0) {
      throw new Error('WeaponInventory requires at least one registered weapon.');
    }
    for (const definition of catalog.values()) {
      this.runtimes.set(definition.id, new WeaponRuntime(definition));
    }
    this.activeWeaponId = this.weaponIds[0];
    this.primaryWeaponId = catalog.get('assault-rifle') ? 'assault-rifle' : this.weaponIds[0];
    this.secondaryWeaponId = catalog.get('pistol') ? 'pistol' : this.weaponIds.find((id) => id !== this.primaryWeaponId) ?? this.primaryWeaponId;
  }

  public get active(): WeaponRuntime {
    return this.runtimes.get(this.activeWeaponId) as WeaponRuntime;
  }

  public get allWeaponIds(): readonly string[] {
    return this.weaponIds;
  }

  public get loadout(): Pick<PlayerLoadout, 'primaryWeaponId' | 'secondaryWeaponId'> {
    return { primaryWeaponId: this.primaryWeaponId, secondaryWeaponId: this.secondaryWeaponId };
  }

  public applyLoadout(loadout: Pick<PlayerLoadout, 'primaryWeaponId' | 'secondaryWeaponId'>): boolean {
    const primary = this.runtimes.get(loadout.primaryWeaponId)?.definition;
    const secondary = this.runtimes.get(loadout.secondaryWeaponId)?.definition;
    if (!primary || !secondary || primary.category !== 'primary' || secondary.category !== 'secondary' || primary.id === secondary.id) return false;
    this.primaryWeaponId = primary.id;
    this.secondaryWeaponId = secondary.id;
    this.activeWeaponId = primary.id;
    return true;
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
    this.activeWeaponId = this.primaryWeaponId;
  }

  public addReserveAmmo(amount: number, weaponIds = this.weaponIds): number {
    let added = 0;
    for (const weaponId of weaponIds) {
      added += this.runtimes.get(weaponId)?.addReserveAmmo(amount) ?? 0;
    }
    return added;
  }

  public canResupply(): boolean { return [...this.runtimes.values()].some((runtime) => runtime.getSnapshot().reserveAmmo < runtime.definition.maximumReserveAmmo); }
}
