// 포켓몬이 "지금 배틀에서 쓰는 기술" 을 정하는 단일 규칙.
// 요약 화면(내 포켓몬)과 배틀(buildCombatant)이 이 함수를 똑같이 써서
// 두 화면의 기술 목록이 항상 일치하도록 한다.
//
// 규칙(어나더레드/포켓몬 게임에 가깝게): 현재 레벨까지 배운 기술 중
// 가장 최근에 배운(레벨 높은) 순서로 최대 4개. 같은 레벨이면 위력 높은 것 우선.
// (현재 배틀 엔진은 공격기술만 처리하므로 위력>0 만 채택 — 변화기술 지원은 다음 단계)

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
  return [...learned]
    .filter((m) => m.power > 0)
    .sort((a, b) => b.level_learned - a.level_learned || b.power - a.power)
    .slice(0, MAX_BATTLE_MOVES);
}
