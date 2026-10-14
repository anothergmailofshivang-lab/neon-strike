export const MAX_PLAYER_LEVEL = 50;

/** Cumulative XP required for a level. Level one starts at zero XP. */
export function xpForLevel(level: number): number {
  const safeLevel = Math.min(Math.max(Math.floor(level), 1), MAX_PLAYER_LEVEL);
  const index = safeLevel - 1;
  return 100 * index + 25 * index * Math.max(index - 1, 0);
}

export function getLevelForXp(xp: number): number {
  const safeXp = Math.max(Number.isFinite(xp) ? xp : 0, 0);
  if (safeXp >= xpForLevel(MAX_PLAYER_LEVEL)) return MAX_PLAYER_LEVEL;
  let low = 1;
  let high = MAX_PLAYER_LEVEL;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (xpForLevel(middle) <= safeXp) low = middle;
    else high = middle - 1;
  }
  return low;
}

export function getLevelProgress(xp: number): { level: number; current: number; required: number; remaining: number; fraction: number; capped: boolean } {
  const safeXp = Math.max(Number.isFinite(xp) ? xp : 0, 0);
  const level = getLevelForXp(safeXp);
  if (level >= MAX_PLAYER_LEVEL) return { level, current: 0, required: 0, remaining: 0, fraction: 1, capped: true };
  const start = xpForLevel(level);
  const required = xpForLevel(level + 1) - start;
  const current = Math.min(Math.max(safeXp - start, 0), required);
  return { level, current, required, remaining: Math.max(required - current, 0), fraction: required > 0 ? current / required : 1, capped: false };
}

export function levelsCrossed(previousXp: number, currentXp: number): number[] {
  const previous = getLevelForXp(previousXp);
  const current = getLevelForXp(currentXp);
  const crossed: number[] = [];
  for (let level = previous + 1; level <= current; level += 1) crossed.push(level);
  return crossed;
}
