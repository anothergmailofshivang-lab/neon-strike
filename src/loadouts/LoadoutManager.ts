import type { WeaponSkinRegistry } from '../cosmetics/WeaponSkinRegistry';
import type { WeaponDefinition } from '../weapons/WeaponTypes';
import { DEFAULT_PLAYER_LOADOUT } from './LoadoutDefinitions';
import type { PlayerLoadout } from './LoadoutTypes';
import { validateLoadout } from './LoadoutValidator';

export class LoadoutManager {
  private value: PlayerLoadout;

  public constructor(
    private readonly catalog: ReadonlyMap<string, WeaponDefinition>,
    private readonly skins: WeaponSkinRegistry,
    initial: PlayerLoadout = DEFAULT_PLAYER_LOADOUT,
  ) {
    this.value = validateLoadout(initial, catalog, skins);
  }

  public get loadout(): PlayerLoadout { return { ...this.value }; }
  public get weaponCatalog(): readonly WeaponDefinition[] { return [...this.catalog.values()]; }
  public get skinRegistry(): WeaponSkinRegistry { return this.skins; }

  public setLoadout(loadout: PlayerLoadout): PlayerLoadout {
    this.value = validateLoadout(loadout, this.catalog, this.skins);
    return this.loadout;
  }

  public setPrimaryWeapon(id: string): PlayerLoadout { return this.setLoadout({ ...this.value, primaryWeaponId: id }); }
  public setSecondaryWeapon(id: string): PlayerLoadout { return this.setLoadout({ ...this.value, secondaryWeaponId: id }); }
  public setPrimarySkin(id: string): PlayerLoadout { return this.setLoadout({ ...this.value, primarySkinId: id }); }
  public setSecondarySkin(id: string): PlayerLoadout { return this.setLoadout({ ...this.value, secondarySkinId: id }); }
  public setTacticalEquipment(id: string): PlayerLoadout { return this.setLoadout({ ...this.value, tacticalEquipmentId: id }); }
  public setUtilityEquipment(id: string): PlayerLoadout { return this.setLoadout({ ...this.value, utilityEquipmentId: id }); }
  public reset(): PlayerLoadout { this.value = validateLoadout(DEFAULT_PLAYER_LOADOUT, this.catalog, this.skins); return this.loadout; }
}
