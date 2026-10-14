import type { WeaponDefinition } from '../weapons/WeaponTypes';
import { getRewardDefinition, listRewardDefinitions, rewardIdForWeaponSkin, type RewardDefinition } from './RewardCatalog';
import type { PlayerProfile } from './ProgressionTypes';

export class InventoryService {
  public isOwned(profile: PlayerProfile, rewardId: string): boolean {
    return profile.entitlements.includes(rewardId);
  }

  public isWeaponSkinOwned(profile: PlayerProfile, skinId: string): boolean {
    return this.isOwned(profile, rewardIdForWeaponSkin(skinId));
  }

  public grant(profile: PlayerProfile, rewardId: string): boolean {
    if (!getRewardDefinition(rewardId) || this.isOwned(profile, rewardId)) return false;
    profile.entitlements.push(rewardId);
    return true;
  }

  public equipTitle(profile: PlayerProfile, rewardId: string): boolean {
    const reward = getRewardDefinition(rewardId);
    if (!reward || reward.category !== 'title' || !this.isOwned(profile, rewardId)) return false;
    profile.equippedCosmetics.titleId = rewardId;
    return true;
  }

  public equipBadge(profile: PlayerProfile, rewardId: string): boolean {
    const reward = getRewardDefinition(rewardId);
    if (!reward || reward.category !== 'badge' || !this.isOwned(profile, rewardId)) return false;
    profile.equippedCosmetics.badgeId = rewardId;
    return true;
  }

  public isCompatible(rewardId: string, weapon: WeaponDefinition): boolean {
    const reward = getRewardDefinition(rewardId);
    return Boolean(reward && reward.category === 'weapon-skin' && (!reward.compatibleWeaponIds || reward.compatibleWeaponIds.includes(weapon.id)));
  }

  public canEquipWeaponSkin(profile: PlayerProfile, rewardId: string, weapon: WeaponDefinition): boolean {
    return this.isOwned(profile, rewardId) && this.isCompatible(rewardId, weapon);
  }

  public list(profile: PlayerProfile): readonly { reward: RewardDefinition; owned: boolean; equipped: boolean }[] {
    return listRewardDefinitions().map((reward) => ({ reward, owned: this.isOwned(profile, reward.id), equipped: reward.id === profile.equippedCosmetics.titleId || reward.id === profile.equippedCosmetics.badgeId }));
  }
}
