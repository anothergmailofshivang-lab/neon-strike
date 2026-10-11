import * as THREE from 'three';
import type { DamageSystem } from '../combat/DamageSystem';
import { CombatTargetRegistry } from '../combat/HitDetection';
import { TargetDummy, createTargetDummyDefinitions } from './TargetDummy';
import type { MapTrainingTargetDefinition } from '../world/MapDefinition';

export class TargetRange {
  public readonly group = new THREE.Group();
  private readonly targets: TargetDummy[] = [];
  private readonly registry: CombatTargetRegistry;
  private readonly damageSystem: DamageSystem;

  public constructor(damageSystem: DamageSystem, registry: CombatTargetRegistry, definitions: readonly MapTrainingTargetDefinition[] = createTargetDummyDefinitions()) {
    this.registry = registry;
    this.damageSystem = damageSystem;
    this.group.name = 'PracticeTargetRange';
    this.setDefinitions(definitions);
  }

  public setDefinitions(definitions: readonly MapTrainingTargetDefinition[]): void {
    this.clearTargets();
    this.group.clear();
    for (const definition of definitions) {
      const target = new TargetDummy(definition);
      this.targets.push(target);
      this.group.add(target.root);
      this.registry.register(target);
      this.damageSystem.register(target);
    }
  }

  public update(deltaSeconds: number): void {
    for (const target of this.targets) {
      target.update(deltaSeconds);
    }
  }

  public reset(): void {
    for (const target of this.targets) {
      target.reset();
    }
  }

  public getTargets(): readonly TargetDummy[] {
    return this.targets;
  }

  public dispose(): void {
    this.clearTargets();
    this.group.clear();
  }

  private clearTargets(): void {
    for (const target of this.targets) {
      this.registry.unregister(target.entityId);
      this.damageSystem.unregister(target.entityId);
      target.dispose();
    }
    this.targets.length = 0;
  }
}
