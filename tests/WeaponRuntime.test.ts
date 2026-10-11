import { describe, expect, it } from 'vitest';
import { WEAPON_DEFINITIONS } from '../src/weapons/WeaponDefinitions';
import { WeaponRuntime } from '../src/weapons/WeaponRuntime';
import { WeaponRuntimeState } from '../src/weapons/WeaponTypes';

describe('WeaponRuntime', () => {
  it('consumes magazine ammunition and reloads from reserve', () => {
    const definition = WEAPON_DEFINITIONS.find((weapon) => weapon.id === 'pistol')!;
    const runtime = new WeaponRuntime(definition);

    expect(runtime.consumeShot()).toBe(true);
    expect(runtime.getSnapshot().magazineAmmo).toBe(definition.magazineCapacity - 1);
    expect(runtime.startReload()).toBe(true);
    expect(runtime.getSnapshot().state).toBe(WeaponRuntimeState.RELOADING);
    runtime.update(definition.reloadDuration);
    expect(runtime.getSnapshot().magazineAmmo).toBe(definition.magazineCapacity);
    expect(runtime.getSnapshot().state).toBe(WeaponRuntimeState.READY);
  });

  it('prevents firing while reloading and never exceeds reserve limits', () => {
    const definition = WEAPON_DEFINITIONS.find((weapon) => weapon.id === 'shotgun')!;
    const runtime = new WeaponRuntime(definition);
    runtime.consumeShot();
    runtime.startReload();
    expect(runtime.consumeShot()).toBe(false);
    runtime.update(definition.reloadDuration);
    expect(runtime.addReserveAmmo(10000)).toBeGreaterThan(0);
    expect(runtime.getSnapshot().reserveAmmo).toBeLessThanOrEqual(definition.maximumReserveAmmo);
  });
});
