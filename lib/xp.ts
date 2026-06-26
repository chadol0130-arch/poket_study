// 경험치 곡선 — DB의 level_for_xp 와 동일한 규칙 (표시/테스트용).
// xp_to_reach(L) = base * (L-1)^exponent, 누적 총 경험치 기준.

export const XP_BASE = 100;
export const XP_EXPONENT = 1.5;
export const MAX_LEVEL = 100;

/**
 * 레벨 L 에 도달하기 위해 필요한 누적 경험치.
 * ceil 로 올림 → 이 값을 채우면 levelForXp 가 반드시 L 이상이 되도록 일관성 유지.
 */
export function xpToReach(level: number): number {
  if (level <= 1) return 0;
  return Math.ceil(XP_BASE * Math.pow(level - 1, XP_EXPONENT));
}

/** 누적 총 경험치 -> 현재 레벨 */
export function levelForXp(totalXp: number): number {
  if (totalXp <= 0) return 1;
  let level = 1;
  while (level < MAX_LEVEL && totalXp >= XP_BASE * Math.pow(level, XP_EXPONENT)) {
    level += 1;
  }
  return level;
}

export interface LevelProgress {
  level: number;
  inLevelXp: number; // 현재 레벨 안에서 쌓은 경험치
  neededXp: number; // 다음 레벨까지 필요한 총량
  pct: number; // 0..1
}

/** 다음 레벨까지의 진행률 */
export function levelProgress(totalXp: number): LevelProgress {
  const level = levelForXp(totalXp);
  const cur = xpToReach(level);
  const next = xpToReach(level + 1);
  const inLevelXp = totalXp - cur;
  const neededXp = Math.max(1, next - cur);
  const pct = level >= MAX_LEVEL ? 1 : Math.max(0, Math.min(1, inLevelXp / neededXp));
  return { level, inLevelXp, neededXp, pct };
}
