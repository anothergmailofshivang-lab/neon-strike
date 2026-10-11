import { moveTowardsScalar } from '../player/PlayerMath';
import type { RecoilProfile } from './WeaponTypes';

export class RecoilController {
  private vertical = 0;
  private horizontal = 0;

  public apply(profile: RecoilProfile, random = Math.random): { pitch: number; yaw: number } {
    this.vertical = Math.min(this.vertical + profile.vertical, profile.maximumAccumulation);
    this.horizontal = Math.min(
      Math.max(this.horizontal + profile.horizontal * (random() > 0.5 ? 1 : -1), -profile.maximumAccumulation),
      profile.maximumAccumulation,
    );
    return { pitch: this.vertical, yaw: this.horizontal };
  }

  public update(deltaSeconds: number, profile: RecoilProfile): { pitch: number; yaw: number } {
    const recovery = Math.max(deltaSeconds, 0) * profile.recovery;
    const previousVertical = this.vertical;
    const previousHorizontal = this.horizontal;
    this.vertical = moveTowardsScalar(this.vertical, 0, recovery);
    this.horizontal = moveTowardsScalar(this.horizontal, 0, recovery);
    return { pitch: previousVertical - this.vertical, yaw: previousHorizontal - this.horizontal };
  }

  public reset(): void {
    this.vertical = 0;
    this.horizontal = 0;
  }

  public getAccumulation(): { pitch: number; yaw: number } {
    return { pitch: this.vertical, yaw: this.horizontal };
  }
}
