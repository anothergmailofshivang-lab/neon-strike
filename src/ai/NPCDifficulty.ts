export interface DifficultyConfig {
  id: 'easy' | 'normal' | 'hard' | 'expert';
  perceptionRangeMultiplier: number;
  reactionDelay: number;
  aimErrorMultiplier: number;
  decisionIntervalMultiplier: number;
  coverPreferenceMultiplier: number;
  aggressionMultiplier: number;
  memoryDuration: number;
  coordinationMultiplier: number;
}

export const DIFFICULTIES: Readonly<Record<DifficultyConfig['id'], DifficultyConfig>> = {
  easy: {
    id: 'easy', perceptionRangeMultiplier: 0.85, reactionDelay: 0.55, aimErrorMultiplier: 1.8,
    decisionIntervalMultiplier: 1.35, coverPreferenceMultiplier: 0.75, aggressionMultiplier: 0.75,
    memoryDuration: 2.5, coordinationMultiplier: 0.5,
  },
  normal: {
    id: 'normal', perceptionRangeMultiplier: 1, reactionDelay: 0.3, aimErrorMultiplier: 1,
    decisionIntervalMultiplier: 1, coverPreferenceMultiplier: 1, aggressionMultiplier: 1,
    memoryDuration: 4, coordinationMultiplier: 1,
  },
  hard: {
    id: 'hard', perceptionRangeMultiplier: 1.1, reactionDelay: 0.18, aimErrorMultiplier: 0.72,
    decisionIntervalMultiplier: 0.82, coverPreferenceMultiplier: 1.2, aggressionMultiplier: 1.15,
    memoryDuration: 5, coordinationMultiplier: 1.25,
  },
  expert: {
    id: 'expert', perceptionRangeMultiplier: 1.15, reactionDelay: 0.1, aimErrorMultiplier: 0.5,
    decisionIntervalMultiplier: 0.65, coverPreferenceMultiplier: 1.4, aggressionMultiplier: 1.25,
    memoryDuration: 6, coordinationMultiplier: 1.5,
  },
};

export function getDifficulty(id: DifficultyConfig['id']): DifficultyConfig {
  return DIFFICULTIES[id];
}
