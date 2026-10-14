import { ACHIEVEMENT_DEFINITIONS, type AchievementDefinition } from './AchievementCatalog';
import { getMasteryTierIndex } from './WeaponMasteryService';
import type { PlayerProfile } from './ProgressionTypes';
import { InventoryService } from './InventoryService';

export interface AchievementUnlock {
  definition: AchievementDefinition;
  progress: number;
  rewardId?: string;
}

export class AchievementService {
  public constructor(private readonly inventory = new InventoryService()) {}

  public evaluate(profile: PlayerProfile, now = new Date()): AchievementUnlock[] {
    const unlocks: AchievementUnlock[] = [];
    for (const definition of ACHIEVEMENT_DEFINITIONS) {
      const current = metricValue(profile, definition);
      const existing = profile.achievements[definition.id] ?? { progress: 0, completedAt: null };
      existing.progress = Math.max(existing.progress, current);
      if (existing.completedAt === null && current >= definition.target) {
        existing.completedAt = now.toISOString();
        const rewardId = definition.rewardId && this.inventory.grant(profile, definition.rewardId) ? definition.rewardId : undefined;
        unlocks.push({ definition, progress: current, rewardId });
      }
      profile.achievements[definition.id] = existing;
    }
    return unlocks;
  }
}

function metricValue(profile: PlayerProfile, definition: AchievementDefinition): number {
  if (definition.metric === 'campaignMissions') return Object.values(profile.campaign.records).filter((record) => record.completedAt).length;
  if (definition.metric === 'level') return profile.highestLevel;
  if (definition.metric === 'mapsCompleted') return profile.career.mapsCompleted.length;
  if (definition.metric === 'modesPlayed') return profile.career.modesPlayed.length;
  if (definition.metric === 'weaponsUsed') return profile.career.weaponsUsed.length;
  if (definition.metric === 'masteredWeapons') return Object.values(profile.weaponMastery).filter((record) => getMasteryTierIndex(record.masteryXp) >= 2).length;
  return profile.career[definition.metric];
}
