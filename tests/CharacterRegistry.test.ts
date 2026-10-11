import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CHARACTER_DEFINITIONS, getCharacterDefinition } from '../src/characters/CharacterDefinitions';
import { CharacterRegistry } from '../src/characters/CharacterRegistry';
import { CharacterSelection, defaultAppearance, validateAppearance } from '../src/characters/CharacterCustomization';
import { createCharacterVisual } from '../src/characters/CharacterFactory';
import { getCharacterDefinitionForNPC } from '../src/characters/NPCVisualVariants';

describe('character catalog and customization', () => {
  it('registers five distinct original characters with valid defaults', () => {
    const registry = new CharacterRegistry(CHARACTER_DEFINITIONS);
    expect(registry.list()).toHaveLength(5);
    expect(new Set(registry.list().map((entry) => entry.id)).size).toBe(5);
    expect(registry.get('circuit').silhouette).toBe('robotic');
    expect(registry.get('bastion').defaultAppearance.paletteId).toBe('graphite-orange');
  });

  it('changes appearance without changing the character identity', () => {
    const registry = new CharacterRegistry(CHARACTER_DEFINITIONS);
    const selection = new CharacterSelection(registry);
    selection.selectCharacter('volt');
    selection.setPalette('acid-lime');
    expect(selection.selectedCharacterId).toBe('volt');
    expect(selection.appearance.paletteId).toBe('acid-lime');
    expect(() => validateAppearance(registry.get('volt'), { ...selection.appearance, accessoryIds: ['unsupported'] })).toThrow();
  });

  it('creates visibly different disposable procedural models and maps NPC variants independently', () => {
    const vanguard = getCharacterDefinition('vanguard');
    const circuit = getCharacterDefinition('circuit');
    const first = createCharacterVisual(vanguard, defaultAppearance(vanguard));
    const second = createCharacterVisual(circuit, defaultAppearance(circuit));
    expect(first.root.children.length).toBeGreaterThan(5);
    expect(second.root.children.length).toBeGreaterThan(5);
    expect(getCharacterDefinitionForNPC('heavy').id).toBe('bastion');
    expect(first.root).toBeInstanceOf(THREE.Group);
    first.dispose();
    second.dispose();
  });
});
