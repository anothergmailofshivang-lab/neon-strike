import type { WeaponDefinition } from '../weapons/WeaponTypes';
import { getRewardDefinition } from './RewardCatalog';
import type { MatchProgressionStats, PlayerProfile, WeaponMatchStats } from './ProgressionTypes';
import { InventoryService } from './InventoryService';

export const MASTERY_TIERS = ['Recruit', 'Field Tested', 'Specialist', 'Expert', 'Master'] as const;
export const MASTERY_THRESHOLDS = [0, 300, 900, 2000, 4000] as const;

export interface MasteryResult {
  weaponId: string;
  xp: number;
  tier: string;
  previousTier: string;
  rewardId?: string;
}

export class WeaponMasteryService {
  public constructor(private readonly weapons: ReadonlyMap<string, WeaponDefinition>, private readonly inventory = new InventoryService()) {}

  public applyMatch(profile: PlayerProfile, stats: MatchProgressionStats): MasteryResult[] {
    const results: MasteryResult[] = [];
    for (const weaponStats of stats.weapons) {
      const definition = this.weapons.get(weaponStats.weaponId);
      if (!definition || this.isPractice(stats)) continue;
      const gained = calculateMasteryXp(weaponStats);
      const used = weaponStats.shots > 0 || weaponStats.hits > 0 || weaponStats.damage > 0 || weaponStats.eliminations > 0;
      if (!used) continue;
      const record = profile.weaponMastery[definition.id] ?? { weaponId: definition.id, masteryXp: 0, eliminations: 0, hits: 0, shots: 0, damage: 0, matchesUsed: 0, highestTier: 0 };
      const previousTier = getMasteryTier(record.masteryXp);
      record.masteryXp += gained;
      record.eliminations += weaponStats.eliminations;
      record.hits += weaponStats.hits;
      record.shots += weaponStats.shots;
      record.damage += weaponStats.damage;
      record.matchesUsed += 1;
      const currentTierIndex = getMasteryTierIndex(record.masteryXp);
      record.highestTier = Math.max(record.highestTier, currentTierIndex);
      profile.weaponMastery[definition.id] = record;
      const result: MasteryResult = { weaponId: definition.id, xp: gained, tier: MASTERY_TIERS[currentTierIndex], previousTier };
      if (currentTierIndex >= 2 && record.highestTier === currentTierIndex && previousTier !== MASTERY_TIERS[currentTierIndex]) {
        const reward = getRewardDefinition('weapon-skin:mastery-chrome');
        if (reward && this.inventory.grant(profile, reward.id)) result.rewardId = reward.id;
      }
      results.push(result);
    }
    return results;
  }

  public getTier(profile: PlayerProfile, weaponId: string): { name: string; index: number; xp: number; nextXp: number | null } {
    const record = profile.weaponMastery[weaponId];
    const xp = record?.masteryXp ?? 0;
    const index = getMasteryTierIndex(xp);
    return { name: MASTERY_TIERS[index], index, xp, nextXp: MASTERY_THRESHOLDS[index + 1] ?? null };
  }

  private isPractice(stats: MatchProgressionStats): boolean {
    return stats.snapshot.settings.modeId === 'practice';
  }
}

export function getMasteryTierIndex(xp: number): number {
  let index = 0;
  for (let tier = 0; tier < MASTERY_THRESHOLDS.length; tier += 1) if (xp >= MASTERY_THRESHOLDS[tier]) index = tier;
  return index;
}

export function getMasteryTier(xp: number): string {
  return MASTERY_TIERS[getMasteryTierIndex(xp)];
}

function calculateMasteryXp(stats: WeaponMatchStats): number {
  return Math.max(0, Math.round(stats.eliminations * 100 + stats.hits + stats.damage * 0.05));
}
