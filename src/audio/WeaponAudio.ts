import type { WeaponDefinition } from '../weapons/WeaponTypes';

export class WeaponAudio {
  private context: AudioContext | null = null;
  private enabled = true;

  public async resume(): Promise<void> {
    if (typeof AudioContext === 'undefined') {
      return;
    }
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
    } catch {
      this.enabled = false;
    }
  }

  public playShot(weapon: WeaponDefinition): void {
    if (!this.enabled || !this.context || this.context.state !== 'running') {
      return;
    }
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    const frequency = weapon.firingMode === 'energy' ? 620 : weapon.firingMode === 'pellet' ? 110 : weapon.baseDamage > 50 ? 180 : 260;
    oscillator.type = weapon.firingMode === 'energy' ? 'sine' : 'square';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(frequency * 0.55, 60), now + 0.07);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.085);
  }

  public playReload(): void {
    if (!this.enabled || !this.context || this.context.state !== 'running') {
      return;
    }
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(180, now);
    oscillator.frequency.linearRampToValueAtTime(280, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.025, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.17);
  }

  public dispose(): void {
    void this.context?.close();
    this.context = null;
  }
}
