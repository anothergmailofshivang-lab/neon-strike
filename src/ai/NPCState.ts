export enum NPCState {
  IDLE = 'IDLE',
  PATROL = 'PATROL',
  INVESTIGATE = 'INVESTIGATE',
  SEARCH = 'SEARCH',
  ALERT = 'ALERT',
  ENGAGE = 'ENGAGE',
  STRAFE = 'STRAFE',
  REPOSITION = 'REPOSITION',
  SEEK_COVER = 'SEEK_COVER',
  IN_COVER = 'IN_COVER',
  FLANK = 'FLANK',
  RETREAT = 'RETREAT',
  RELOAD = 'RELOAD',
  RECOVER_NAVIGATION = 'RECOVER_NAVIGATION',
  DEFEATED = 'DEFEATED',
  RESPAWNING = 'RESPAWNING',
}

export interface NPCStateTransition {
  previous: NPCState;
  next: NPCState;
  reason: string;
  time: number;
}
