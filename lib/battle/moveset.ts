// 포켓몬이 "지금 배틀에서 쓰는 기술" 을 정하는 단일 규칙.
// 요약 화면(내 포켓몬)과 배틀(buildCombatant)이 이 함수를 똑같이 써서
// 두 화면의 기술 목록이 항상 일치하도록 한다.
//
// 규칙(어나더레드/포켓몬 게임에 가깝게): 현재 레벨까지 배운 기술 중
// 가장 최근에 배운(레벨 높은) 순서로 최대 4개. 같은 레벨이면 위력 높은 것 우선.
// 변화기술도 포함하되, 공격기술이 하나도 없으면 가장 강한 공격기술 1개를 보장한다.

export interface LearnableMove {
  move_key: string;
  level_learned: number;
  name_ko: string;
  power: number;
  type: string;
  category: number;
  pp?: number;
  description?: string;
}

export const MAX_BATTLE_MOVES = 4;

export function selectBattleMoves<T extends { level_learned: number; power: number }>(
  learned: T[],
): T[] {
  const sorted = [...learned].sort(
    (a, b) => b.level_learned - a.level_learned || b.power - a.power,
  );
  const pick = sorted.slice(0, MAX_BATTLE_MOVES);
  // 공격기술이 하나도 없으면(전부 변화기술) 가장 강한 공격기술 1개를 넣어 배틀이 끝나도록
  if (!pick.some((m) => m.power > 0)) {
    const dmg = [...sorted].sort((a, b) => b.power - a.power).find((m) => m.power > 0);
    if (dmg) {
      if (pick.length >= MAX_BATTLE_MOVES) pick[pick.length - 1] = dmg;
      else pick.push(dmg);
    }
  }
  return pick;
}
