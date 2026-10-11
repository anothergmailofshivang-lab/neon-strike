import * as THREE from 'three';

export interface NPCMemorySnapshot {
  targetVisible: boolean;
  lastKnownPosition: THREE.Vector3 | null;
  lastSeenTime: number;
  confidence: number;
  lastSoundPosition: THREE.Vector3 | null;
  lastDamageTime: number;
}

export class NPCMemory {
  private targetVisible = false;
  private lastKnownPosition: THREE.Vector3 | null = null;
  private lastSeenTime = -Infinity;
  private confidence = 0;
  private lastSoundPosition: THREE.Vector3 | null = null;
  private lastDamageTime = -Infinity;

  public observeTarget(position: THREE.Vector3, time: number): void {
    this.targetVisible = true;
    this.lastKnownPosition ??= new THREE.Vector3();
    this.lastKnownPosition.copy(position);
    this.lastSeenTime = time;
    this.confidence = 1;
  }

  public loseVisual(time: number, memoryDuration: number): void {
    this.targetVisible = false;
    this.confidence = Math.max(0, 1 - Math.max(time - this.lastSeenTime, 0) / Math.max(memoryDuration, 0.001));
  }

  public hear(position: THREE.Vector3, time: number): void {
    this.lastSoundPosition ??= new THREE.Vector3();
    this.lastSoundPosition.copy(position);
    this.lastSeenTime = Math.max(this.lastSeenTime, time);
  }

  public receiveSquadContact(position: THREE.Vector3, time: number): void {
    this.lastKnownPosition ??= new THREE.Vector3();
    this.lastKnownPosition.copy(position);
    this.lastSeenTime = Math.max(this.lastSeenTime, time);
    this.targetVisible = false;
    this.confidence = Math.max(this.confidence, 0.35);
  }

  public recordDamage(time: number): void {
    this.lastDamageTime = time;
  }

  public clear(): void {
    this.targetVisible = false;
    this.lastKnownPosition = null;
    this.lastSeenTime = -Infinity;
    this.confidence = 0;
    this.lastSoundPosition = null;
    this.lastDamageTime = -Infinity;
  }

  public get snapshot(): NPCMemorySnapshot {
    return {
      targetVisible: this.targetVisible,
      lastKnownPosition: this.lastKnownPosition?.clone() ?? null,
      lastSeenTime: this.lastSeenTime,
      confidence: this.confidence,
      lastSoundPosition: this.lastSoundPosition?.clone() ?? null,
      lastDamageTime: this.lastDamageTime,
    };
  }
}
