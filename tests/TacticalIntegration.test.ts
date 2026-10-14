import * as THREE from 'three';
import { describe, it, expect, vi } from 'vitest';
import { CollisionWorld } from '../src/physics/CollisionWorld';
import { CombatEventBus } from '../src/combat/CombatEvents';
import { DamageSystem } from '../src/combat/DamageSystem';
import { CombatTargetRegistry, HitDetection } from '../src/combat/HitDetection';
import { PlayerHealth } from '../src/player/PlayerHealth';
import { TargetDummy } from '../src/targets/TargetDummy';
import { TacticalEquipmentService } from '../src/tactical/TacticalEquipmentService';
import { ThrowableSimulation, releasePosition } from '../src/tactical/ThrowableSimulation';
import { resolveExplosion } from '../src/tactical/ExplosionResolver';
import { getEquipmentDefinition } from '../src/equipment/EquipmentCatalog';
import { DEFAULT_PLAYER_LOADOUT } from '../src/loadouts/LoadoutDefinitions';
import { AmmoPickupSystem } from '../src/weapons/AmmoPickupSystem';
import type { WeaponController } from '../src/weapons/WeaponController';
import { WeaponInventory } from '../src/weapons/WeaponInventory';
import { createWeaponCatalog } from '../src/weapons/WeaponDefinitions';
import { DoorController } from '../src/tactical/DoorController';
import { InteractionManager } from '../src/tactical/InteractionManager';
import { DestructibleObject } from '../src/tactical/DestructibleObject';
import { getWeaponDefinition } from '../src/weapons/WeaponDefinitions';
import { MAP_DEFINITIONS } from '../src/world/maps/MapCatalog';
import { MapInstance } from '../src/world/MapInstance';
import { DestructibleManager } from '../src/tactical/DestructibleManager';
import { NPCPerception } from '../src/ai/NPCPerception';
import { NPCController } from '../src/ai/NPCController';
import { getNPCArchetype } from '../src/ai/NPCDefinitions';
import { NavigationGraph } from '../src/navigation/NavigationGraph';
import { CoverRegistry } from '../src/world/CoverRegistry';

const floor = { name: 'floor', size: [100, 0.2, 100] as const, position: [0, -0.1, 0] as const };
const wall = { name: 'wall', size: [0.2, 8, 30] as const, position: [2, 4, 0] as const };
class Actor extends TargetDummy {
  public constructor(id: string, position: [number, number, number], public readonly teamId = 'enemy', maxHealth = 100) {
    super({ id, position, maxHealth, respawnDelay: 10, accentColor: 0xff0000 });
  }
}
const tick = (service: { update: (delta: number) => void }, seconds: number): void => { for (let i = 0; i < Math.ceil(seconds * 60); i++) service.update(1 / 60); };

describe('throwables in real Rapier geometry', () => {
  it('uses aim, gravity and a stable timestep; rejects releases into walls', async () => {
    const world = await CollisionWorld.create([floor, wall]);
    try {
      const origin = new THREE.Vector3(0, 2, 0);
      expect(releasePosition(world, new THREE.Vector3(1.6, 2, 0), new THREE.Vector3(1, 0, 0))).toBeNull();
      expect(releasePosition(world, origin, new THREE.Vector3(0, 1, 0))?.y).toBeCloseTo(2.65);
      const a = new ThrowableSimulation(origin, new THREE.Vector3(0, 6, -8), getEquipmentDefinition('frag-grenade'));
      const b = new ThrowableSimulation(origin, new THREE.Vector3(0, 6, -8), getEquipmentDefinition('frag-grenade'));
      for (let i = 0; i < 30; i++) a.update(1 / 60, world);
      for (let i = 0; i < 15; i++) b.update(1 / 30, world);
      expect(a.position.distanceTo(b.position)).toBeLessThan(0.00001);
      expect(a.position.z).toBeCloseTo(-4);
      expect(a.position.y).toBeGreaterThan(2);
      expect(a.velocity.y).toBeLessThan(6);
    } finally { world.dispose(); }
  });
  it('sweeps a sphere through thin walls, loses bounce energy and detonates exactly once', async () => {
    const world = await CollisionWorld.create([floor, wall]);
    try {
      const projectile = new ThrowableSimulation(new THREE.Vector3(0, 2, 0), new THREE.Vector3(80, 0, 0), getEquipmentDefinition('frag-grenade'));
      projectile.update(0.1, world);
      expect(projectile.position.x).toBeLessThan(1.9);
      expect(projectile.velocity.x).toBeLessThan(0);
      expect(projectile.velocity.length()).toBeLessThan(80);
      let detonations = 0;
      for (let i = 0; i < 180; i++) if (projectile.update(1 / 60, world) === 'detonate') detonations++;
      expect(detonations).toBe(1);
      expect(projectile.finished).toBe(true);
      expect(projectile.position.y).toBeGreaterThan(0.1);
    } finally { world.dispose(); }
  });
});

describe('blast cover, team rules and attribution', () => {
  it('damages exposed enemies once with falloff, excludes walls/allies/out-of-range, and removes prop collision', async () => {
    const world = await CollisionWorld.create([floor, wall]);
    const events = new CombatEventBus(), damage = new DamageSystem(events);
    const actors = [new Actor('player', [-4, 0, 0], 'player'), new Actor('near', [0, 0, 1]), new Actor('far', [0, 0, 4]), new Actor('blocked', [3, 0, 0]), new Actor('outside', [0, 0, 10]), new Actor('ally', [0, 0, 2], 'player')];
    actors.forEach((actor) => damage.register(actor));
    const prop = new DestructibleObject({ id: 'crate', position: [0, 0.5, -1], size: [1, 1, 1], maxHealth: 20, materialColor: 0xaa7733 }, world);
    damage.register(prop);
    const received: string[] = [];
    events.subscribe((event) => { if (event.type === 'damage-applied') { expect(event.request.weaponId).toBe('frag-grenade'); expect(event.request.sourceId).toBe('player'); received.push(event.result.targetId); } });
    try {
      resolveExplosion(world, damage, 'player', getEquipmentDefinition('frag-grenade'), new THREE.Vector3(0, 1, 0), 0);
      expect(actors[1].health).toBeLessThan(actors[2].health);
      expect(actors[3].health).toBe(100);
      expect(actors[4].health).toBe(100);
      expect(actors[5].health).toBe(100);
      expect(new Set(received).size).toBe(received.length);
      expect(prop.isDefeated).toBe(true);
      expect(world.raycastStaticWorld(new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 0, -1), 2)).toBeNull();
      prop.reset();
      expect(world.raycastStaticWorld(new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 0, -1), 2)).not.toBeNull();
    } finally { prop.dispose(); actors.forEach((actor) => actor.dispose()); world.dispose(); }
  });
});

describe('shared equipment lifecycle', () => {
  async function fixture(tactical = 'frag-grenade', utility = 'med-kit') {
    const world = await CollisionWorld.create([floor]);
    const events = new CombatEventBus(), damage = new DamageSystem(events), player = new PlayerHealth(new THREE.Group());
    damage.register(player);
    let active = false;
    const service = new TacticalEquipmentService(new THREE.Scene(), world, damage, player, null, () => active);
    service.applyLoadout({ ...DEFAULT_PLAYER_LOADOUT, tacticalEquipmentId: tactical, utilityEquipmentId: utility });
    return { world, events, damage, player, service, active: (value: boolean) => { active = value; }, dispose: () => { service.dispose(); world.dispose(); } };
  }
  const origin = new THREE.Vector3(0, 1.6, 0), direction = new THREE.Vector3(0, 0, -1);
  it('blocks menus, pause, death and duplicate activation; freezes fuses and clears old projectiles', async () => {
    const f = await fixture();
    try {
      expect(f.service.usePlayer('tactical', origin, direction, 'practice').accepted).toBe(false);
      f.active(true);
      expect(f.service.usePlayer('tactical', origin, direction, 'practice').accepted).toBe(true);
      expect(f.service.usePlayer('tactical', origin, direction, 'practice').accepted).toBe(false);
      const position = f.service.projectilePositions[0];
      f.active(false); tick(f.service, 5);
      expect(f.service.projectilePositions[0].equals(position)).toBe(true);
      expect(f.service.getSnapshot('tactical')?.charges).toBe(1);
      f.service.clearTransient(); f.active(true); tick(f.service, 5);
      expect(f.service.activeProjectileCount).toBe(0);
      f.damage.applyDirectDamage(f.player, 100, 'enemy', 'frag-grenade', origin, 1);
      expect(f.service.usePlayer('tactical', origin, direction, 'practice').accepted).toBe(false);
    } finally { f.dispose(); }
  });
  it('heals only after recovery completes, clamps health, and does not consume cancelled/full-health uses', async () => {
    const f = await fixture();
    try {
      f.active(true);
      expect(f.service.usePlayer('utility', origin, direction, 'practice').accepted).toBe(false);
      f.damage.applyDirectDamage(f.player, 20, 'enemy', 'pistol', origin, 0);
      f.service.usePlayer('utility', origin, direction, 'practice'); tick(f.service, 0.5); f.service.cancelUse(); tick(f.service, 2);
      expect(f.player.health).toBe(80); expect(f.service.getSnapshot('utility')?.charges).toBe(1);
      f.service.usePlayer('utility', origin, direction, 'practice'); tick(f.service, 1.3);
      expect(f.player.health).toBe(100); expect(f.service.getSnapshot('utility')?.charges).toBe(0);
    } finally { f.dispose(); }
  });
  it('smoke affects real perception, agrees with its visual extent and expires', async () => {
    const f = await fixture('smoke-grenade');
    try {
      f.active(true); f.service.usePlayer('tactical', origin, direction, 'practice'); tick(f.service, 0.75);
      expect(f.service.activeSmokeCount).toBe(1);
      const observer = new THREE.Vector3(0, 0, 0), target = new THREE.Vector3(0, 1.2, -10);
      const perception = new NPCPerception(f.world, { sightRange: 30, fieldOfView: Math.PI, reactionDelay: 0 }, (a, b) => f.service.visibility.blocksLineOfSight(a, b));
      expect(perception.canSee(observer, 0, target)).toBe(false);
      tick(f.service, 8.2);
      expect(f.service.activeSmokeCount).toBe(0);
      expect(perception.canSee(observer, 0, target)).toBe(true);
    } finally { f.dispose(); }
  });
  it('sensor reveals eligible nearby NPCs temporarily and flash statuses expire', async () => {
    const f = await fixture('flash-device', 'sensor-pulse');
    const enemy = new Actor('enemy', [0, 0, -10]), ally = new Actor('ally', [0, 0, -8], 'player'), far = new Actor('far', [0, 0, -40]);
    for (const actor of [enemy, ally, far]) f.damage.register(actor);
    try {
      f.active(true); f.service.usePlayer('utility', origin, direction, 'practice');
      expect(f.service.isRevealed('enemy')).toBe(true); expect(f.service.isRevealed('ally')).toBe(false); expect(f.service.isRevealed('far')).toBe(false);
      f.service.usePlayer('tactical', origin, direction, 'practice'); tick(f.service, 0.82);
      expect(f.service.isDisoriented('enemy')).toBe(true);
      tick(f.service, 6.1);
      expect(f.service.isRevealed('enemy')).toBe(false); expect(f.service.isDisoriented('enemy')).toBe(false);
    } finally { [enemy, ally, far].forEach((actor) => actor.dispose()); f.dispose(); }
  });
  it('NPC roles have one real charge and reject unsafe friendly throws', async () => {
    const f = await fixture();
    const npc = new Actor('rifleman', [0, 0, 0], 'enemy'), ally = new Actor('ally', [0, 0, -10], 'enemy');
    f.damage.register(npc); f.damage.register(ally);
    try {
      f.service.registerNpc('rifleman', 'rifleman'); f.service.registerNpc('sniper', 'sniper'); f.active(true);
      expect(f.service.useNpc('sniper', origin, new THREE.Vector3(0, 1, -10))).toBe(false);
      expect(f.service.useNpc('rifleman', origin, new THREE.Vector3(0, 1, -10))).toBe(false);
      ally.root.position.set(30, 0, 30);
      expect(f.service.useNpc('rifleman', origin, new THREE.Vector3(0, 1, -10))).toBe(true);
      tick(f.service, 15);
      expect(f.service.useNpc('rifleman', origin, new THREE.Vector3(0, 1, -10))).toBe(false);
    } finally { npc.dispose(); ally.dispose(); f.dispose(); }
  });
  it('resupply uses actual reserve capacities, preserves magazines and cannot waste a full-inventory charge', async () => {
    const f = await fixture('frag-grenade', 'ammo-pack');
    const inventory = new WeaponInventory(createWeaponCatalog());
    const weapons = { collectAmmo: (amount: number) => inventory.addReserveAmmo(amount), playTacticalCue: () => {} } as unknown as WeaponController;
    f.service.setWeaponController(weapons);
    try {
      inventory.addReserveAmmo(100000); f.active(true);
      expect(f.service.usePlayer('utility', origin, direction, 'practice').accepted).toBe(false);
      expect(f.service.getSnapshot('utility')?.charges).toBe(1);
      const pistol = inventory.getRuntime('pistol')!;
      for (let i = 0; i < 12; i++) { pistol.consumeShot(); pistol.update(0.3); }
      pistol.startReload(); pistol.update(2);
      expect(f.service.usePlayer('utility', origin, direction, 'practice').accepted).toBe(true);
      expect(pistol.getSnapshot().reserveAmmo).toBe(pistol.definition.maximumReserveAmmo);
      expect(pistol.getSnapshot().magazineAmmo).toBe(pistol.definition.magazineCapacity);
      f.service.usePlayer('tactical', origin, direction, 'practice');
      expect(f.service.addChargesForEquipment('smoke-grenade', 10)).toBe(0);
      expect(f.service.addChargesForEquipment('frag-grenade', 10)).toBe(1);
      expect(f.service.addChargesForEquipment('frag-grenade', 1)).toBe(0);
    } finally { f.dispose(); }
  });
});

describe('world objects', () => {
  it('doors move real collision and refuse closure on occupied passages; switches honor wall visibility', async () => {
    const world = await CollisionWorld.create([floor]);
    const door = new DoorController({ id: 'door', label: 'Test door', hinge: [0, 0, 0], width: 2, height: 3, color: 0x444444 }, world);
    try {
      const ray = () => world.raycastStaticWorld(new THREE.Vector3(1, 1, 2), new THREE.Vector3(0, 0, -1), 4);
      expect(ray()).not.toBeNull(); expect(door.toggle([])).toBe(true);
      for (let i = 0; i < 120; i++) door.update(1 / 60, []);
      expect(door.state).toBe('open'); expect(ray()).toBeNull();
      expect(door.toggle([new THREE.Vector3(1, 0, 0)])).toBe(false);
      expect(door.toggle([])).toBe(true); for (let i = 0; i < 120; i++) door.update(1 / 60, []);
      expect(door.state).toBe('closed'); expect(ray()).not.toBeNull();
      let canInteract = true;
      const manager = new InteractionManager(new THREE.Scene(), world, () => true, () => {}, () => canInteract);
      manager.setDefinitions([{ id: 'switch', type: 'switch', label: 'Beacon', position: [1, 1, -1], radius: 4, color: 0xffff00 }]);
      expect(manager.getPrompt(new THREE.Vector3(1, 1, 2), new THREE.Vector3(0, 0, -1))).toBeNull();
      expect(manager.interact(new THREE.Vector3(1, 1, -2), new THREE.Vector3(0, 0, 1))).toContain('Enable Beacon');
      expect(manager.group.children.some((node) => node instanceof THREE.PointLight && node.intensity > 0)).toBe(true);
      canInteract = false;
      expect(manager.interact(new THREE.Vector3(1, 1, -2), new THREE.Vector3(0, 0, 1))).toBeNull();
      manager.setDefinitions([], [{ id: 'npc-door', label: 'NPC door', hinge: [10, 0, 0], width: 2, height: 3, color: 0x444444 }]);
      for (let i = 0; i < 120; i++) manager.update(1 / 60, [], [new THREE.Vector3(10, 0, 0)]);
      expect(world.raycastStaticWorld(new THREE.Vector3(11, 1, 2), new THREE.Vector3(0, 0, -1), 4)).toBeNull();
      expect(manager.getPrompt(new THREE.Vector3(10, 1, 1), new THREE.Vector3(0, 0, -1))).toBeNull();
      canInteract = true;
      expect(manager.getPrompt(new THREE.Vector3(10, 1, 1), new THREE.Vector3(0, 0, -1))).toContain('Close');
      manager.clear(); expect(manager.getPrompt(new THREE.Vector3(), new THREE.Vector3(0, 0, -1))).toBeNull(); manager.dispose();
    } finally { door.dispose(); world.dispose(); }
  });
  it('bullets destroy a crate through shared raycast/damage and clear solid collision exactly once', async () => {
    const world = await CollisionWorld.create([floor]), events = new CombatEventBus(), damage = new DamageSystem(events), registry = new CombatTargetRegistry();
    const crate = new DestructibleObject({ id: 'crate', position: [0, 0.7, -3], size: [1.4, 1.4, 1.4], maxHealth: 40, materialColor: 0x888888 }, world);
    const scene = new THREE.Scene(); scene.add(crate.root); scene.updateMatrixWorld(true);
    registry.register(crate); damage.register(crate);
    const deaths = vi.fn(); events.subscribe((event) => { if (event.type === 'target-defeated') deaths(); });
    try {
      const hit = new HitDetection(new THREE.PerspectiveCamera(), world, registry).resolve(new THREE.Vector3(0, 0.7, 0), new THREE.Vector3(0, 0, -1), 10);
      expect(hit.target).toBe(crate);
      damage.applyWeaponHit(crate, getWeaponDefinition('sniper-rifle'), 'body', 3, hit.point, new THREE.Vector3(0, 0, -1), 0);
      damage.applyWeaponHit(crate, getWeaponDefinition('sniper-rifle'), 'body', 3, hit.point, new THREE.Vector3(0, 0, -1), 0);
      expect(deaths).toHaveBeenCalledTimes(1); expect(crate.root.visible).toBe(false);
      expect(world.raycastStaticWorld(new THREE.Vector3(0, 0.7, 0), new THREE.Vector3(0, 0, -1), 10)).toBeNull();
    } finally { crate.dispose(); world.dispose(); }
  });
  it('collects only useful resources once and freezes pickup respawn while paused', async () => {
    const world = await CollisionWorld.create([floor]); let active = true;
    const health = new PlayerHealth(new THREE.Group()), events = new CombatEventBus(), damage = new DamageSystem(events); damage.register(health);
    const audio = vi.fn(), ammo = vi.fn(() => 0);
    const weapons = { collectAmmo: ammo, playTacticalCue: audio } as unknown as WeaponController;
    const pickup = new AmmoPickupSystem([{ id: 'health', type: 'health', position: [0, 0.5, 0], amount: 28, respawnSeconds: 1 }], null, world, () => active);
    const update = () => pickup.update(1 / 60, new THREE.Vector3(), weapons, health);
    try {
      update(); expect(pickup.group.children[0].visible).toBe(true);
      damage.applyDirectDamage(health, 70, 'enemy', 'frag-grenade', new THREE.Vector3(), 0);
      update(); update(); expect(health.health).toBe(58); expect(audio).toHaveBeenCalledTimes(1);
      active = false; for (let i = 0; i < 120; i++) update(); expect(pickup.group.children[0].visible).toBe(false);
      active = true; for (let i = 0; i < 62; i++) update(); expect(health.health).toBe(86);
      damage.applyDirectDamage(health, 100, 'enemy', 'frag-grenade', new THREE.Vector3(), 1);
      for (let i = 0; i < 62; i++) update();
      expect(health.health).toBe(0); expect(pickup.group.children[0].visible).toBe(true); expect(audio).toHaveBeenCalledTimes(2);
      pickup.setDefinitions([]); expect(pickup.group.children).toHaveLength(0);
    } finally { pickup.dispose(); world.dispose(); }
  });
});

describe('NPC decision integration', () => {
  it('a perceiving rifleman releases one tactical projectile and continues ordinary weapon fire', async () => {
    const world = await CollisionWorld.create([floor]), scene = new THREE.Scene(), bus = new CombatEventBus(), damage = new DamageSystem(bus);
    const playerRoot = new THREE.Group(); playerRoot.position.set(0, 0, -14); scene.add(playerRoot);
    const player = new PlayerHealth(playerRoot, 10000); damage.register(player);
    let active = false;
    const tactical = new TacticalEquipmentService(scene, world, damage, player, null, () => active);
    tactical.applyLoadout(DEFAULT_PLAYER_LOADOUT);
    const graph = new NavigationGraph(); graph.addNode({ id: 'home', position: new THREE.Vector3(), tags: [] });
    const npc = new NPCController('rifleman', getNPCArchetype('rifleman'), 'normal', new THREE.Vector3(), scene, world, graph, new CoverRegistry(), player, damage, bus, [], 'enemy', (a, b) => tactical.visibility.blocksLineOfSight(a, b), tactical);
    damage.register(npc); tactical.registerNpc(npc.entityId, 'rifleman');
    const uses = vi.fn(), shots = vi.fn(); tactical.events.subscribe((event) => { if (event.type === 'equipment-used') uses(event); });
    bus.subscribe((event) => { if (event.type === 'weapon-fired') shots(); });
    try {
      active = true;
      for (let step = 0; step < 1200; step++) { tactical.update(1 / 60); npc.update(1 / 60); }
      expect(uses).toHaveBeenCalledTimes(1);
      expect(uses.mock.calls[0][0]).toMatchObject({ ownerId: 'rifleman', equipmentId: 'frag-grenade' });
      expect(shots.mock.calls.length).toBeGreaterThan(1);
      expect(player.health).toBeLessThan(player.maxHealth);
    } finally { npc.dispose(); tactical.dispose(); world.dispose(); }
  });
});

describe('five-map tactical placement and cleanup', () => {
  for (const definition of MAP_DEFINITIONS) it(definition.id, async () => {
    const map = new MapInstance(definition, definition.build()), world = await CollisionWorld.create(map.collisionDefinitions);
    const damage = new DamageSystem(new CombatEventBus()), registry = new CombatTargetRegistry(), props = new DestructibleManager(world, damage, registry);
    try {
      for (const prop of definition.destructibles ?? []) expect(world.isSphereClear(new THREE.Vector3(...prop.position), 0.5), prop.id).toBe(true);
      const clearRoutes = map.navigationGraph.getAllNodes().flatMap((node) => map.navigationGraph.getNeighbors(node.id).map((edge) => {
        const start = node.position.clone().add(new THREE.Vector3(0, 1, 0));
        const end = map.navigationGraph.getNode(edge.to)!.position.clone().add(new THREE.Vector3(0, 1, 0));
        return { start, direction: end.clone().sub(start).normalize(), length: start.distanceTo(end), id: `${node.id}->${edge.to}` };
      })).filter((route) => !world.sweepSphere(route.start, route.direction, route.length, 0.5));
      props.setDefinitions(definition.destructibles ?? []);
      for (const route of clearRoutes) expect.soft(world.sweepSphere(route.start, route.direction, route.length, 0.5), route.id).toBeNull();
      for (const pickup of map.pickups) expect.soft(world.isSphereClear(new THREE.Vector3(...pickup.position), 0.28), pickup.id).toBe(true);
      for (const panel of definition.interactions ?? []) expect(world.isSphereClear(new THREE.Vector3(...panel.position), 0.15), panel.id).toBe(true);
      const eyes = map.playerSpawns[0].position.clone().add(new THREE.Vector3(0, 1.6, 0));
      for (const pitch of [-0.8, 0, 0.8]) {
        const direction = new THREE.Vector3(0, pitch, -1).normalize();
        const release = releasePosition(world, eyes, direction);
        expect(release).not.toBeNull();
        const projectile = new ThrowableSimulation(release!, direction.multiplyScalar(13), getEquipmentDefinition('frag-grenade'));
        for (let step = 0; step < 100; step++) projectile.update(1 / 60, world);
        expect(projectile.finished).toBe(true);
        expect(projectile.position.y).toBeGreaterThan(0.1);
      }
      props.clear(); expect(damage.getTargets()).toHaveLength(0); expect(registry.regionsForRaycast).toHaveLength(0);
    } finally { props.dispose(); world.dispose(); map.dispose(); }
  });
});
