import * as THREE from 'three';
import type { Damageable } from '../combat/Damageable';
import type { DamageRequest, DamageResult, HitRegionBinding } from '../combat/DamageTypes';

export interface TargetDummyConfig {
  id: string;
  position: readonly [number, number, number];
  maxHealth: number;
  respawnDelay: number;
  accentColor: number;
}

export class TargetDummy implements Damageable {
  public readonly entityId: string;
  public readonly root = new THREE.Group();
  public readonly maxHealth: number;
  private readonly bodyMesh: THREE.Mesh;
  private readonly criticalMesh: THREE.Mesh;
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly criticalMaterial: THREE.MeshStandardMaterial;
  private readonly healthBarBackground: THREE.Mesh;
  private readonly healthBarFill: THREE.Mesh;
  private readonly healthBarBackgroundMaterial: THREE.MeshBasicMaterial;
  private readonly healthBarFillMaterial: THREE.MeshBasicMaterial;
  private readonly config: TargetDummyConfig;
  private readonly regions: readonly HitRegionBinding[];
  private currentHealth: number;
  private defeated = false;
  private respawnRemaining = 0;
  private flashRemaining = 0;

  public constructor(config: TargetDummyConfig) {
    this.config = config;
    this.entityId = config.id;
    this.maxHealth = config.maxHealth;
    this.currentHealth = config.maxHealth;
    this.root.name = `TargetDummy:${config.id}`;
    this.root.position.set(...config.position);

    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x75849b,
      roughness: 0.6,
      metalness: 0.25,
      emissive: 0x07111a,
      emissiveIntensity: 0.3,
    });
    this.criticalMaterial = new THREE.MeshStandardMaterial({
      color: config.accentColor,
      roughness: 0.45,
      metalness: 0.25,
      emissive: config.accentColor,
      emissiveIntensity: 1.4,
    });
    this.bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 1.65, 12), this.bodyMaterial);
    this.bodyMesh.position.y = 0.95;
    this.bodyMesh.name = `${config.id}:body`;
    this.criticalMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 10), this.criticalMaterial);
    this.criticalMesh.position.y = 2.15;
    this.criticalMesh.name = `${config.id}:critical`;
    this.healthBarBackgroundMaterial = new THREE.MeshBasicMaterial({ color: 0x07111a, transparent: true, opacity: 0.85 });
    this.healthBarFillMaterial = new THREE.MeshBasicMaterial({ color: config.accentColor });
    this.healthBarBackground = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.1), this.healthBarBackgroundMaterial);
    this.healthBarFill = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.07), this.healthBarFillMaterial);
    this.healthBarBackground.position.set(0, 2.85, 0);
    this.healthBarFill.position.set(-0.05, 2.85, -0.01);
    this.root.add(this.bodyMesh, this.criticalMesh, this.healthBarBackground, this.healthBarFill);
    this.regions = [
      { object: this.bodyMesh, region: 'body', damageMultiplier: 1 },
      { object: this.criticalMesh, region: 'critical', damageMultiplier: 1 },
    ];
  }

  public get health(): number {
    return this.currentHealth;
  }

  public get isDefeated(): boolean {
    return this.defeated;
  }

  public getHitRegions(): readonly HitRegionBinding[] {
    return this.regions;
  }

  public receiveDamage(request: DamageRequest): DamageResult {
    if (this.defeated || request.targetId !== this.entityId || !Number.isFinite(request.finalDamage) || request.finalDamage <= 0) {
      return {
        applied: false,
        damage: 0,
        critical: false,
        defeated: this.defeated,
        targetId: this.entityId,
        impactPoint: request.impactPoint.clone(),
      };
    }

    const damage = Math.min(Math.max(request.finalDamage, 0), this.currentHealth);
    this.currentHealth = Math.max(this.currentHealth - damage, 0);
    this.flashRemaining = 0.08;
    this.defeated = this.currentHealth <= 0;
    this.updateHealthBar();
    if (this.defeated) {
      this.respawnRemaining = this.config.respawnDelay;
    this.root.visible = false;
    }
    const result: DamageResult = {
      applied: damage > 0,
      damage,
      critical: request.hitRegion === 'critical',
      defeated: this.defeated,
      targetId: this.entityId,
      impactPoint: request.impactPoint.clone(),
    };
    return result;
  }

  public update(deltaSeconds: number): void {
    const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
    if (this.defeated) {
      this.respawnRemaining = Math.max(this.respawnRemaining - delta, 0);
      if (this.respawnRemaining === 0) {
        this.reset();
      }
      return;
    }
    this.flashRemaining = Math.max(this.flashRemaining - delta, 0);
    const flash = this.flashRemaining > 0 ? 2.5 : 0.3;
    this.bodyMaterial.emissiveIntensity = flash;
  }

  public reset(): void {
    this.currentHealth = this.maxHealth;
    this.defeated = false;
    this.respawnRemaining = 0;
    this.flashRemaining = 0;
    this.root.visible = true;
    this.bodyMaterial.emissiveIntensity = 0.3;
    this.updateHealthBar();
  }

  public getHealthRatio(): number {
    return this.maxHealth > 0 ? this.currentHealth / this.maxHealth : 0;
  }

  public dispose(): void {
    this.bodyMesh.geometry.dispose();
    this.criticalMesh.geometry.dispose();
    this.bodyMaterial.dispose();
    this.criticalMaterial.dispose();
    this.healthBarBackground.geometry.dispose();
    this.healthBarFill.geometry.dispose();
    this.healthBarBackgroundMaterial.dispose();
    this.healthBarFillMaterial.dispose();
    this.root.clear();
  }

  private updateHealthBar(): void {
    const ratio = this.getHealthRatio();
    this.healthBarFill.scale.x = Math.max(ratio, 0.001);
    this.healthBarFill.position.x = -0.65 + 0.6 * ratio;
  }
}

export function createTargetDummyDefinitions(): readonly TargetDummyConfig[] {
  return [
    { id: 'target-alpha', position: [0, 0, -8], maxHealth: 100, respawnDelay: 3, accentColor: 0x00e5ff },
    { id: 'target-bravo', position: [-9, 0, -10], maxHealth: 150, respawnDelay: 4, accentColor: 0xff774f },
    { id: 'target-charlie', position: [9, 0, -10], maxHealth: 150, respawnDelay: 4, accentColor: 0xffc857 },
    { id: 'target-delta', position: [0, 0, -16], maxHealth: 250, respawnDelay: 5, accentColor: 0x9fff55 },
  ];
}
