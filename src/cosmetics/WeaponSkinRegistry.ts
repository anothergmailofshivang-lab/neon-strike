import type { WeaponSkinDefinition } from './WeaponSkinDefinitions';
import { validateWeaponSkin } from './WeaponSkinDefinitions';

export class WeaponSkinRegistry {
  private readonly skins = new Map<string, WeaponSkinDefinition>();

  public constructor(definitions: readonly WeaponSkinDefinition[]) {
    for (const skin of definitions) {
      validateWeaponSkin(skin);
      if (this.skins.has(skin.id)) throw new Error(`Weapon skin ID is already registered: ${skin.id}`);
      this.skins.set(skin.id, skin);
    }
  }

  public get(id: string): WeaponSkinDefinition {
    const skin = this.skins.get(id);
    if (!skin) throw new Error(`Unknown weapon skin ID: ${id}`);
    return skin;
  }

  public has(id: string): boolean { return this.skins.has(id); }
  public list(): readonly WeaponSkinDefinition[] { return [...this.skins.values()]; }
}
