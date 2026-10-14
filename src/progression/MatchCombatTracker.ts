import type { CombatEvent } from '../combat/CombatEvents';
import type { TacticalEvent } from '../tactical/TacticalEvents';
import type { MatchSession } from '../match/MatchSession';
import { createWeaponCatalog } from '../weapons/WeaponDefinitions';
import { emptyTacticalStats, type MatchProgressionStats, type WeaponMatchStats } from './ProgressionTypes';

/** Bridges shared combat events to match scoring and finalized progression in callback order. */
export class MatchCombatTracker {
  private readonly weapons = new Map<string, WeaponMatchStats>();
  private readonly catalog = createWeaponCatalog();
  private readonly damageSeen = new WeakSet<object>();
  private readonly tacticalSeen = new WeakSet<object>();
  private readonly propsDestroyed = new Set<string>();
  private readonly tactical = emptyTacticalStats();
  public constructor(private readonly session: MatchSession, private readonly propIds: ReadonlySet<string> = new Set()) {}
  public snapshot(): MatchProgressionStats { return { snapshot: this.session.snapshot(), weapons: [...this.weapons.values()].map((entry) => ({ ...entry })), tactical: { ...this.tactical }, destroyedPropIds: [...this.propsDestroyed] }; }
  public restore(stats: MatchProgressionStats): void {
    if (!this.session.externallyDirected || this.session.phase !== 'preparing') throw new Error('Combat restore requires a preparing mission');
    this.weapons.clear();
    for (const entry of stats.weapons) this.weapons.set(entry.weaponId, { ...entry });
    Object.assign(this.tactical, stats.tactical ?? emptyTacticalStats());
    this.propsDestroyed.clear();
    for (const id of stats.destroyedPropIds ?? []) if (this.propIds.has(id)) this.propsDestroyed.add(id);
  }

  public combat(event: CombatEvent): boolean {
    if (this.session.phase !== 'active') return false;
    if (event.type === 'weapon-fired' && event.sourceId) {
      this.session.recordShot(event.sourceId, event.shotCount);
      if (event.sourceId === 'player' && this.session.getParticipant('player')?.alive && this.catalog.has(event.weapon.id)) this.weapon(event.weapon.id).shots += event.shotCount;
    } else if (event.type === 'damage-applied' && event.result.applied) {
      if (this.damageSeen.has(event.request)) return false;
      this.damageSeen.add(event.request);
      const { sourceId, targetId, weaponId } = event.request;
      const weapon = this.catalog.has(weaponId);
      this.session.recordDamage(sourceId, targetId, event.result.damage, event.result.critical, weaponId, weapon);
      if (sourceId === 'player' && this.session.areOpponents(sourceId, targetId)) {
        if (weapon) {
          const record = this.weapon(weaponId);
          record.damage += event.result.damage; record.hits++;
          if (event.result.critical) record.criticalHits++;
        } else if (weaponId === 'frag-grenade') this.tactical.explosiveDamage += event.result.damage;
      }
    } else if (event.type === 'target-defeated' && event.result.applied) {
      const { sourceId, targetId, weaponId } = event.request;
      if (sourceId === 'player' && this.propIds.has(targetId) && !this.propsDestroyed.has(targetId)) {
        this.propsDestroyed.add(targetId); this.tactical.propsDestroyed++;
      }
      if (sourceId === 'player' && this.session.getParticipant(targetId)?.alive && this.session.areOpponents(sourceId, targetId)) {
        // Must precede recordElimination, which may synchronously finalize the entire match.
        if (this.catalog.has(weaponId)) this.weapon(weaponId).eliminations++;
        else if (weaponId === 'frag-grenade') this.tactical.explosiveEliminations++;
      }
      return this.session.recordElimination(sourceId, targetId);
    }
    return false;
  }
  public event(event: TacticalEvent): void {
    if (this.session.phase !== 'active' || this.tacticalSeen.has(event)) return;
    this.tacticalSeen.add(event);
    if (event.type === 'equipment-used' && event.ownerId === 'player') this.tactical.equipmentUses++;
    if (event.type === 'pickup-collected' && event.amount > 0) this.tactical.resourcesCollected++;
  }
  private weapon(id: string): WeaponMatchStats {
    let record = this.weapons.get(id);
    if (!record) { record = { weaponId: id, shots: 0, hits: 0, damage: 0, eliminations: 0, criticalHits: 0 }; this.weapons.set(id, record); }
    return record;
  }
}
