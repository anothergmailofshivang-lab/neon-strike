import * as THREE from 'three';
import type { DamageSystem } from '../combat/DamageSystem';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { PlayerHealth } from '../player/PlayerHealth';
import type { WeaponController } from '../weapons/WeaponController';
import { getEquipmentDefinition, normalizeEquipmentId } from '../equipment/EquipmentCatalog';
import type { EquipmentDefinition, EquipmentRuntimeSnapshot, EquipmentSlot } from '../equipment/EquipmentTypes';
import { EquipmentRuntime } from '../equipment/EquipmentRuntime';
import type { PlayerLoadout } from '../loadouts/LoadoutTypes';
import { VisibilityFieldRegistry } from './VisibilityFieldRegistry';
import { TacticalEventBus } from './TacticalEvents';
import { releasePosition, THROW_SPEED, ThrowableSimulation } from './ThrowableSimulation';
import { exposed, resolveExplosion } from './ExplosionResolver';
import { TacticalEffects } from './TacticalEffects';

interface Projectile { id: string; ownerId: string; motion: ThrowableSimulation; mesh: THREE.Mesh; }
interface Smoke { id: string; mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>; remaining: number; radius: number; }

export class TacticalEquipmentService {
  public readonly group = new THREE.Group();
  public readonly events = new TacticalEventBus();
  public readonly visibility = new VisibilityFieldRegistry();
  private readonly playerRuntimes = new Map<EquipmentSlot, EquipmentRuntime>();
  private readonly npcRuntimes = new Map<string, EquipmentRuntime>();
  private readonly projectiles = new Map<string, Projectile>();
  private readonly smokes = new Map<string, Smoke>();
  private readonly sensorMarkers = new Map<string, number>();
  private readonly disoriented = new Map<string, number>();
  private readonly geometry = new THREE.SphereGeometry(0.13, 10, 8);
  private readonly effects = new TacticalEffects(this.group);
  private sequence = 0;
  private simulationTime = 0;
  private playerFlashRemaining = 0;
  private pendingHeal = 0;
  private disposed = false;

  public constructor(
    scene: THREE.Scene,
    private readonly collisionWorld: CollisionWorld,
    private readonly damage: DamageSystem,
    private readonly playerHealth: PlayerHealth,
    private weaponController: Pick<WeaponController, 'collectAmmo' | 'playTacticalCue'> | null = null,
    private readonly isActive: () => boolean = () => false,
    private readonly playerForward: () => THREE.Vector3 = () => new THREE.Vector3(0, 0, -1),
  ) {
    this.group.name = 'TacticalEquipment';
    scene.add(this.group);
  }

  public setWeaponController(weapons: WeaponController): void { this.weaponController = weapons; }
  public applyLoadout(loadout: PlayerLoadout): void {
    if (this.isActive()) return;
    this.playerRuntimes.clear();
    this.playerRuntimes.set('tactical', new EquipmentRuntime(getEquipmentDefinition(normalizeEquipmentId(loadout.tacticalEquipmentId, 'tactical'))));
    this.playerRuntimes.set('utility', new EquipmentRuntime(getEquipmentDefinition(normalizeEquipmentId(loadout.utilityEquipmentId, 'utility'))));
  }

  /** Death/pause cancels an unfinished heal without spending a charge. Released grenades remain live. */
  public cancelUse(): void { this.pendingHeal = 0; }
  public actorDefeated(id: string): void {
    this.sensorMarkers.delete(id); this.disoriented.delete(id);
    if (id === 'player') { this.cancelUse(); this.playerFlashRemaining = 0; }
  }
  /** Round transitions discard deployed effects; resources persist through Survival rounds and respawns. */
  public clearTransient(): void {
    this.cancelUse();
    this.playerFlashRemaining = 0;
    this.sensorMarkers.clear();
    this.disoriented.clear();
    this.visibility.clear();
    for (const projectile of this.projectiles.values()) this.removeProjectile(projectile);
    this.projectiles.clear();
    for (const id of [...this.smokes.keys()]) this.removeSmoke(id);
    this.effects.clear();
  }
  public resetMatch(): void {
    this.clearTransient();
    this.simulationTime = 0;
    for (const runtime of this.playerRuntimes.values()) runtime.reset();
    this.npcRuntimes.clear();
  }

  public registerNpc(ownerId: string, archetype: string): void {
    const id = archetype === 'rifleman' || archetype === 'defender' ? 'frag-grenade' : archetype === 'scout' ? 'smoke-grenade' : null;
    if (!id || this.npcRuntimes.has(ownerId)) return;
    this.npcRuntimes.set(ownerId, new EquipmentRuntime({ ...getEquipmentDefinition(id), startingCharges: 1, maximumCharges: 1, cooldownSeconds: 12 }));
  }
  public unregisterNpc(ownerId: string): void { this.npcRuntimes.delete(ownerId); this.disoriented.delete(ownerId); this.sensorMarkers.delete(ownerId); }

  public update(deltaSeconds: number): void {
    if (!this.isActive() || this.disposed) return;
    const delta = Number.isFinite(deltaSeconds) ? Math.min(Math.max(deltaSeconds, 0), 0.25) : 0;
    this.simulationTime += delta;
    for (const runtime of this.playerRuntimes.values()) runtime.update(delta);
    for (const runtime of this.npcRuntimes.values()) runtime.update(delta);
    this.visibility.update(delta);
    this.effects.update(delta);
    this.playerFlashRemaining = Math.max(this.playerFlashRemaining - delta, 0);
    for (const markers of [this.sensorMarkers, this.disoriented]) for (const [id, expiresAt] of markers) if (expiresAt <= this.simulationTime) markers.delete(id);
    if (this.playerHealth.isDefeated) this.cancelUse();
    if (this.pendingHeal > 0) {
      this.pendingHeal = Math.max(0, this.pendingHeal - delta);
      if (this.pendingHeal < 1e-8) {
        this.pendingHeal = 0;
        const runtime = this.playerRuntimes.get('utility');
        if (runtime?.snapshot().ready && this.playerHealth.health < this.playerHealth.maxHealth) {
          runtime.tryConsume();
          const healed = this.playerHealth.restoreHealth(runtime.definition.effectAmount);
          this.used('player', runtime, 'utility');
          this.feedback('player', runtime.definition, 'heal', healed, this.playerHealth.root.position);
        }
      }
    }
    for (const smoke of [...this.smokes.values()]) {
      smoke.remaining = Math.max(0, smoke.remaining - delta);
      smoke.mesh.material.opacity = 0.93 * Math.min(1, smoke.remaining / 0.5);
      if (smoke.remaining === 0) this.removeSmoke(smoke.id);
    }
    for (const projectile of [...this.projectiles.values()]) {
      if (!this.isActive() || !this.projectiles.has(projectile.id)) break;
      const result = projectile.motion.update(delta, this.collisionWorld);
      projectile.mesh.position.copy(projectile.motion.position);
      projectile.mesh.rotation.x += delta * 5;
      if (result !== 'flying') {
        this.projectiles.delete(projectile.id); // Remove before callbacks can resolve the match.
        this.removeProjectile(projectile);
        if (result === 'detonate') this.detonate(projectile);
      }
    }
  }

  public usePlayer(slot: EquipmentSlot, origin: THREE.Vector3, direction: THREE.Vector3, modeId: string): { accepted: boolean; reason?: string } {
    if (!this.isActive() || this.playerHealth.isDefeated || this.disposed) return { accepted: false, reason: 'INACTIVE' };
    const runtime = this.playerRuntimes.get(slot);
    if (!runtime || !runtime.snapshot().ready || this.pendingHeal > 0) return { accepted: false, reason: 'NOT_READY' };
    const definition = runtime.definition;
    if (definition.allowedModes && !definition.allowedModes.includes(modeId)) return { accepted: false, reason: 'MODE_RESTRICTED' };
    if (definition.kind === 'med-kit') {
      if (this.playerHealth.health >= this.playerHealth.maxHealth) return { accepted: false, reason: 'HEALTH_FULL' };
      this.pendingHeal = 1.2;
      return { accepted: true };
    }
    if (definition.kind === 'ammo-pack') {
      const amount = this.weaponController?.collectAmmo(definition.effectAmount) ?? 0;
      if (!amount) return { accepted: false, reason: 'AMMO_FULL' };
      runtime.tryConsume();
      this.used('player', runtime, slot);
      this.feedback('player', definition, 'ammo', amount, origin);
      return { accepted: true };
    }
    if (definition.kind === 'sensor') {
      runtime.tryConsume();
      let detected = 0;
      for (const target of this.damage.getTargets()) {
        if (!target.teamId || target.teamId === 'player' || target.isDefeated) continue;
        if (target.root.getWorldPosition(new THREE.Vector3()).distanceTo(origin) <= definition.radius) {
          this.sensorMarkers.set(target.entityId, this.simulationTime + definition.effectAmount);
          detected++;
        }
      }
      this.used('player', runtime, slot);
      this.feedback('player', definition, 'sensor', detected, origin);
      return { accepted: true };
    }
    return this.throw('player', runtime, origin, direction) ? { accepted: true } : { accepted: false, reason: 'RELEASE_BLOCKED' };
  }

  /** Called only after the NPC's normal perception/reaction test. One charge per match. */
  public useNpc(ownerId: string, origin: THREE.Vector3, targetPosition: THREE.Vector3): boolean {
    const runtime = this.npcRuntimes.get(ownerId);
    const source = this.damage.getTarget(ownerId);
    if (!this.isActive() || !runtime?.snapshot().ready || !source || source.isDefeated || this.isDisoriented(ownerId)) return false;
    if (runtime.definition.kind === 'smoke') {
      if (source.health / source.maxHealth > 0.45) return false;
      return this.throw(ownerId, runtime, origin, new THREE.Vector3(0, -0.8, -0.2));
    }
    const range = Math.hypot(origin.x - targetPosition.x, origin.z - targetPosition.z);
    if (range < 8 || range > 14 || !exposed(this.collisionWorld, origin, targetPosition) || this.visibility.blocksLineOfSight(origin, targetPosition)) return false;
    for (const ally of this.damage.getTargets()) {
      if (!ally.isDefeated && ally.teamId === source.teamId && ally.root.getWorldPosition(new THREE.Vector3()).distanceTo(targetPosition) < runtime.definition.radius + 1) return false;
    }
    // Solve a fixed-speed ballistic arc to the last visible position, then verify its landing area.
    const arc = ballisticDirection(origin, targetPosition, THROW_SPEED);
    const horizontal = targetPosition.clone().sub(origin).setY(0).normalize();
    // Check one direct arc and three grounded bank throws with the identical simulator.
    // No hidden-target queries: all candidates aim at the currently perceived position.
    const candidates = [arc, ...[-0.3, -0.65, -1].map((pitch) => horizontal.clone().setY(pitch).normalize())];
    for (const direction of candidates) {
      if (!direction) continue;
      const release = releasePosition(this.collisionWorld, origin, direction);
      if (!release) continue;
      const predicted = new ThrowableSimulation(release, direction.clone().multiplyScalar(THROW_SPEED), runtime.definition);
      for (let step = 0; step < 120 && !predicted.finished; step++) predicted.update(1 / 60, this.collisionWorld);
      if (predicted.position.distanceTo(targetPosition) > 3 || predicted.position.distanceTo(origin) < runtime.definition.radius + 1) continue;
      if (this.damage.getTargets().some((ally) => !ally.isDefeated && ally.teamId === source.teamId && ally.root.getWorldPosition(new THREE.Vector3()).distanceTo(predicted.position) < runtime.definition.radius + 1)) continue;
      return this.throw(ownerId, runtime, origin, direction);
    }
    return false;
  }

  public addChargesForEquipment(equipmentId: string, amount: number): number {
    if (!this.isActive() || this.playerHealth.isDefeated) return 0;
    for (const runtime of this.playerRuntimes.values()) if (runtime.definition.id === equipmentId) return runtime.addCharges(amount);
    return 0;
  }
  public canResupply(equipmentId: string): boolean { return [...this.playerRuntimes.values()].some((runtime) => runtime.definition.id === equipmentId && runtime.snapshot().charges < runtime.definition.maximumCharges); }
  public getSnapshot(slot: EquipmentSlot): EquipmentRuntimeSnapshot | null {
    const snapshot = this.playerRuntimes.get(slot)?.snapshot();
    return snapshot ? { ...snapshot, ready: snapshot.ready && this.isActive() && !this.playerHealth.isDefeated && !this.pendingHeal, useRemaining: slot === 'utility' ? this.pendingHeal : 0 } : null;
  }
  public getPlayerFlashRatio(): number { return this.playerFlashRemaining / 2.2; }
  public smokeDensity(position: THREE.Vector3): number { return [...this.smokes.values()].some((smoke) => smoke.mesh.position.distanceTo(position) < smoke.radius) ? 0.85 : 0; }
  public isRevealed(entityId: string): boolean { return this.sensorMarkers.has(entityId) && !this.damage.getTarget(entityId)?.isDefeated; }
  public isDisoriented(entityId: string): boolean { return this.disoriented.has(entityId); }
  public get activeProjectileCount(): number { return this.projectiles.size; }
  public get activeSmokeCount(): number { return this.smokes.size; }
  public get projectilePositions(): readonly THREE.Vector3[] { return [...this.projectiles.values()].map((p) => p.motion.position.clone()); }
  public breakEffect(position: THREE.Vector3): void { this.effects.pulse(position, 0xc69465, 1, 'break'); this.weaponController?.playTacticalCue('break'); }

  public dispose(): void {
    if (this.disposed) return;
    this.clearTransient();
    this.disposed = true;
    this.npcRuntimes.clear();
    this.events.clear();
    this.effects.dispose();
    this.geometry.dispose();
    this.group.removeFromParent();
  }
  private throw(ownerId: string, runtime: EquipmentRuntime, origin: THREE.Vector3, direction: THREE.Vector3): boolean {
    if (this.projectiles.size >= 12) return false;
    const position = releasePosition(this.collisionWorld, origin, direction);
    if (!position || !runtime.tryConsume().accepted) return false;
    const definition = runtime.definition;
    const id = `throwable-${++this.sequence}`;
    const mesh = new THREE.Mesh(this.geometry, new THREE.MeshStandardMaterial({ color: definition.effectColor, emissive: definition.effectColor, emissiveIntensity: 0.8 }));
    mesh.position.copy(position);
    mesh.name = `${definition.id}:${id}`;
    this.group.add(mesh);
    this.projectiles.set(id, { id, ownerId, mesh, motion: new ThrowableSimulation(position, direction.clone().normalize().multiplyScalar(definition.throwSpeed ?? THROW_SPEED), definition) });
    this.used(ownerId, runtime, 'tactical');
    this.weaponController?.playTacticalCue('throw');
    return true;
  }
  private used(ownerId: string, runtime: EquipmentRuntime, slot: EquipmentSlot): void {
    this.events.emit({ type: 'equipment-used', ownerId, equipmentId: runtime.definition.id, slot });
  }
  private feedback(ownerId: string, definition: EquipmentDefinition, effect: 'heal' | 'ammo' | 'sensor', amount: number, position: THREE.Vector3): void {
    this.effects.pulse(position, definition.effectColor, effect === 'sensor' ? definition.radius : 1);
    this.weaponController?.playTacticalCue(effect);
    this.events.emit({ type: 'equipment-effect', ownerId, equipmentId: definition.id, effect, amount });
  }
  private detonate(projectile: Projectile): void {
    const { definition, position } = projectile.motion;
    this.weaponController?.playTacticalCue(definition.kind);
    if (definition.kind === 'frag') {
      this.effects.pulse(position, definition.effectColor, definition.radius, 'blast');
      resolveExplosion(this.collisionWorld, this.damage, projectile.ownerId, definition, position, this.simulationTime);
    } else if (definition.kind === 'smoke') {
      while (this.smokes.size >= 4) this.removeSmoke(this.smokes.keys().next().value!);
      const id = projectile.id;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(definition.radius, 16, 12), new THREE.MeshBasicMaterial({ color: definition.effectColor, transparent: true, opacity: 0.93, side: THREE.DoubleSide, depthWrite: false }));
      mesh.position.copy(position);
      this.group.add(mesh);
      this.smokes.set(id, { id, mesh, remaining: definition.effectAmount, radius: definition.radius });
      this.visibility.add(id, position, definition.radius, definition.effectAmount);
    } else if (definition.kind === 'flash') {
      this.effects.pulse(position, 0x99b6c9, definition.radius);
      const source = this.damage.getTarget(projectile.ownerId);
      for (const target of this.damage.getTargets()) {
        if (!target.teamId || target.isDefeated || (target.entityId !== projectile.ownerId && target.teamId === source?.teamId)) continue;
        const eyes = target.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.2, 0));
        const toFlash = position.clone().sub(eyes);
        const distance = toFlash.length();
        if (distance > definition.radius || !exposed(this.collisionWorld, position, eyes)) continue;
        const forward = target.entityId === 'player' ? this.playerForward() : new THREE.Vector3(-Math.sin(target.root.rotation.y), 0, -Math.cos(target.root.rotation.y));
        const facing = forward.dot(toFlash.normalize()) > 0.25 ? 1 : 0.25;
        const duration = definition.effectAmount * facing * (1 - distance / definition.radius);
        if (target.entityId === 'player') this.playerFlashRemaining = Math.max(this.playerFlashRemaining, duration);
        else this.disoriented.set(target.entityId, Math.max(this.disoriented.get(target.entityId) ?? 0, this.simulationTime + duration));
      }
    }
  }
  private removeProjectile(projectile: Projectile): void { projectile.mesh.removeFromParent(); (projectile.mesh.material as THREE.Material).dispose(); }
  private removeSmoke(id: string): void {
    const smoke = this.smokes.get(id);
    if (!smoke) return;
    smoke.mesh.removeFromParent(); smoke.mesh.geometry.dispose(); smoke.mesh.material.dispose();
    this.smokes.delete(id); this.visibility.remove(id);
  }
}

export function ballisticDirection(origin: THREE.Vector3, target: THREE.Vector3, speed: number): THREE.Vector3 | null {
  const offset = target.clone().sub(origin);
  const horizontal = Math.hypot(offset.x, offset.z);
  const g = 9.81, v2 = speed * speed;
  const discriminant = v2 * v2 - g * (g * horizontal * horizontal + 2 * offset.y * v2);
  if (horizontal < 0.1 || discriminant < 0) return null;
  const angle = Math.atan((v2 - Math.sqrt(discriminant)) / (g * horizontal));
  return new THREE.Vector3(offset.x / horizontal * Math.cos(angle), Math.sin(angle), offset.z / horizontal * Math.cos(angle));
}
