import { describe, expect, it } from 'vitest';
import { CharacterRegistry } from '../src/characters/CharacterRegistry';
import { CHARACTER_DEFINITIONS } from '../src/characters/CharacterDefinitions';
import { WeaponSkinRegistry } from '../src/cosmetics/WeaponSkinRegistry';
import { WEAPON_SKIN_DEFINITIONS } from '../src/cosmetics/WeaponSkinDefinitions';
import { LoadoutManager } from '../src/loadouts/LoadoutManager';
import { createWeaponCatalog } from '../src/weapons/WeaponDefinitions';
import { SaveManager } from '../src/persistence/SaveManager';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  public getItem(key: string): string | null { return this.values.get(key) ?? null; }
  public setItem(key: string, value: string): void { this.values.set(key, value); }
  public removeItem(key: string): void { this.values.delete(key); }
}

describe('character and loadout persistence', () => {
  it('saves and restores validated preferences', () => {
    const storage = new MemoryStorage();
    const registry = new CharacterRegistry(CHARACTER_DEFINITIONS);
    const loadouts = new LoadoutManager(createWeaponCatalog(), new WeaponSkinRegistry(WEAPON_SKIN_DEFINITIONS));
    const save = new SaveManager(registry, loadouts, storage);
    const character = registry.get('circuit');
    const preferences = {
      characterId: character.id,
      appearance: { characterId: character.id, ...character.defaultAppearance },
       loadout: { primaryWeaponId: 'energy-rifle', secondaryWeaponId: 'pistol', primarySkinId: 'neon-circuit', secondarySkinId: 'arctic', tacticalEquipmentId: 'smoke-grenade', utilityEquipmentId: 'ammo-pack' },
    };
    expect(save.save(preferences)).toBe(true);
    const restored = save.load();
    expect(restored.characterId).toBe('circuit');
    expect(restored.loadout.primaryWeaponId).toBe('energy-rifle');
    expect(restored.loadout.tacticalEquipmentId).toBe('smoke-grenade');
    expect(restored.loadout.utilityEquipmentId).toBe('ammo-pack');
    expect(restored.appearance.paletteId).toBe('sensor-cyan');
  });

  it('falls back safely for malformed or unknown saved values', () => {
    const storage = new MemoryStorage();
    storage.setItem('neon-strike.player-preferences', JSON.stringify({ schemaVersion: 1, characterId: 'missing', appearance: {}, loadout: {} }));
    const registry = new CharacterRegistry(CHARACTER_DEFINITIONS);
    const loadouts = new LoadoutManager(createWeaponCatalog(), new WeaponSkinRegistry(WEAPON_SKIN_DEFINITIONS));
    const restored = new SaveManager(registry, loadouts, storage).load();
    expect(restored.characterId).toBe('vanguard');
    expect(restored.loadout.primaryWeaponId).toBe('assault-rifle');
  });
});
