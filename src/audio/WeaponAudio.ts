import type { WeaponDefinition } from '../weapons/WeaponTypes';

export class WeaponAudio {
  private context: AudioContext | null = null;
  private enabled = true;
  private masterVolume = 1;
  private effectsVolume = 1;
  private output: GainNode | null = null;
  private outputConnected = false;

  public async resume(): Promise<void> {
    if (typeof AudioContext === 'undefined') {
      return;
    }
    try {
      this.context ??= new AudioContext();
      this.output ??= this.context.createGain();
      if (!this.outputConnected) { this.output.connect(this.context.destination); this.outputConnected = true; }
      this.applyVolume();
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
    oscillator.connect(gain).connect(this.output ?? this.context.destination);
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
    oscillator.connect(gain).connect(this.output ?? this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.17);
  }

  public dispose(): void {
    void this.context?.close();
    this.context = null;
    this.output = null;
    this.outputConnected = false;
  }

  public playTactical(cue: string): void {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const frequencies: Record<string, number> = { frag: 65, smoke: 140, flash: 440, heal: 620, ammo: 240, sensor: 780, throw: 180, pickup: 550, switch: 320, break: 90, bounce: 110 };
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    const duration = cue === 'frag' ? 0.28 : 0.12;
    oscillator.type = cue === 'frag' || cue === 'break' ? 'sawtooth' : 'triangle';
    oscillator.frequency.setValueAtTime(frequencies[cue] ?? 240, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, (frequencies[cue] ?? 240) * 0.5), now + duration);
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.output ?? this.context.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  public setVolumes(master: number, effects: number): void {
    this.masterVolume = clamp(master);
    this.effectsVolume = clamp(effects);
    this.applyVolume();
  }

  public async playTestSound(): Promise<boolean> {
    await this.resume();
    if (!this.context || this.context.state !== 'running' || !this.enabled) return false;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(540, now);
    oscillator.frequency.exponentialRampToValueAtTime(280, now + 0.16);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain).connect(this.output ?? this.context.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(now);
    oscillator.stop(now + 0.19);
    return true;
  }

  private applyVolume(): void {
    if (this.output && this.context) this.output.gain.setTargetAtTime(this.masterVolume * this.effectsVolume, this.context.currentTime, 0.01);
  }
}

function clamp(value: number): number { return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 1; }
