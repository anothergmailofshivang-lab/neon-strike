import { WeaponRuntimeState, type WeaponDefinition, type WeaponRuntimeSnapshot } from './WeaponTypes';

export class WeaponRuntime {
  public readonly definition: WeaponDefinition;
  private magazineAmmo: number;
  private reserveAmmo: number;
  private fireCooldown = 0;
  private reloadRemaining = 0;
  private state: WeaponRuntimeState;
  private aiming = false;

  public constructor(definition: WeaponDefinition) {
    this.definition = definition;
    this.magazineAmmo = definition.magazineCapacity;
    this.reserveAmmo = Math.min(definition.startingReserveAmmo, definition.maximumReserveAmmo);
    this.state = WeaponRuntimeState.READY;
  }

  public update(deltaSeconds: number): boolean {
    const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
    this.fireCooldown = Math.max(this.fireCooldown - delta, 0);
    if (this.state !== WeaponRuntimeState.RELOADING) {
      return false;
    }

    this.reloadRemaining = Math.max(this.reloadRemaining - delta, 0);
    if (this.reloadRemaining > 0) {
      return false;
    }

    const roundsNeeded = this.definition.magazineCapacity - this.magazineAmmo;
    const roundsLoaded = Math.min(roundsNeeded, this.reserveAmmo);
    this.magazineAmmo += roundsLoaded;
    this.reserveAmmo -= roundsLoaded;
    this.state = this.magazineAmmo > 0 ? WeaponRuntimeState.READY : WeaponRuntimeState.EMPTY;
    return true;
  }

  public canFire(): boolean {
    return this.state === WeaponRuntimeState.READY && this.fireCooldown <= 0 && this.magazineAmmo > 0;
  }

  public consumeShot(cooldown = this.definition.fireInterval): boolean {
    if (!this.canFire()) {
      if (this.magazineAmmo === 0 && this.state !== WeaponRuntimeState.RELOADING) {
        this.state = WeaponRuntimeState.EMPTY;
      }
      return false;
    }
    this.magazineAmmo -= 1;
    this.fireCooldown = Math.max(cooldown, 0);
    if (this.magazineAmmo === 0) {
      this.state = WeaponRuntimeState.EMPTY;
    }
    return true;
  }

  public startReload(): boolean {
    if (
      this.state === WeaponRuntimeState.RELOADING
      || this.magazineAmmo >= this.definition.magazineCapacity
      || this.reserveAmmo <= 0
    ) {
      return false;
    }
    this.state = WeaponRuntimeState.RELOADING;
    this.reloadRemaining = this.definition.reloadDuration;
    return true;
  }

  public cancelReload(): void {
    if (this.state === WeaponRuntimeState.RELOADING) {
      this.reloadRemaining = 0;
      this.state = this.magazineAmmo > 0 ? WeaponRuntimeState.READY : WeaponRuntimeState.EMPTY;
    }
  }

  public addReserveAmmo(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0;
    }
    const before = this.reserveAmmo;
    this.reserveAmmo = Math.min(this.reserveAmmo + Math.floor(amount), this.definition.maximumReserveAmmo);
    return this.reserveAmmo - before;
  }

  public setSwitching(switching: boolean): void {
    if (switching) {
      this.cancelReload();
      this.state = WeaponRuntimeState.SWITCHING;
    } else {
      this.state = this.magazineAmmo > 0 ? WeaponRuntimeState.READY : WeaponRuntimeState.EMPTY;
    }
  }

  public setAiming(aiming: boolean): void {
    this.aiming = aiming && this.definition.aimDownSights.supported;
  }

  public reset(): void {
    this.magazineAmmo = this.definition.magazineCapacity;
    this.reserveAmmo = Math.min(this.definition.startingReserveAmmo, this.definition.maximumReserveAmmo);
    this.fireCooldown = 0;
    this.reloadRemaining = 0;
    this.state = WeaponRuntimeState.READY;
    this.aiming = false;
  }

  public getSnapshot(): WeaponRuntimeSnapshot {
    return {
      weaponId: this.definition.id,
      state: this.state,
      magazineAmmo: this.magazineAmmo,
      reserveAmmo: this.reserveAmmo,
      magazineCapacity: this.definition.magazineCapacity,
      reloadProgress: this.definition.reloadDuration <= 0
        ? 1
        : 1 - this.reloadRemaining / this.definition.reloadDuration,
      fireCooldown: this.fireCooldown,
      aiming: this.aiming,
    };
  }
}
