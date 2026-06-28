// 순수 배틀 계산 (DB 의존 없음 — 테스트 가능). 데미지/타입상성/스탯 스케일.

export interface Stats {
  hp: number;
  attack: number;
  defense: number;
  special_attack: number;
  special_defense: number;
  speed: number;
}

export interface BattleMove {
  key: string;
  name_ko: string;
  power: number;
  type: string;
  category: number; // 0 물리 / 1 특수 / 2 변화
}

export interface Combatant {
  speciesId: string;
  name: string;
  level: number;
  types: string[];
  stats: Stats;
  maxHp: number;
  hp: number;
  moves: BattleMove[];
  spriteUrl: string | null;
}

export interface TypeRel {
  weaknesses: string[];
  resistances: string[];
  immunities: string[];
}
export type TypeChart = Record<string, TypeRel>;

/** 레벨로 스탯 스케일 */
export function scaleStat(base: number, level: number): number {
  return Math.floor(base * (level / 50 + 1));
}
export function maxHpFor(baseHp: number, level: number): number {
  return Math.floor(baseHp * (level / 50 + 1)) + level + 10;
}

/** 공격 타입 vs 방어 포켓몬 타입들 → 효과 배수 (약점 x2 / 저항 x0.5 / 무효 x0, 듀얼 곱) */
export function typeMultiplier(
  moveType: string,
  defenderTypes: string[],
  chart: TypeChart,
): number {
  let mult = 1;
  for (const dt of defenderTypes) {
    const rel = chart[dt];
    if (!rel) continue;
    if (rel.immunities?.includes(moveType)) mult *= 0;
    else if (rel.weaknesses?.includes(moveType)) mult *= 2;
    else if (rel.resistances?.includes(moveType)) mult *= 0.5;
  }
  return mult;
}

export interface DamageResult {
  damage: number;
  mult: number;
}

export function computeDamage(
  attacker: Combatant,
  defender: Combatant,
  move: BattleMove,
  chart: TypeChart,
  rand: number = Math.random(),
): DamageResult {
  if (move.power <= 0) return { damage: 0, mult: 1 };
  const atk = move.category === 1 ? attacker.stats.special_attack : attacker.stats.attack;
  const def = move.category === 1 ? defender.stats.special_defense : defender.stats.defense;
  const base = Math.floor(
    ((2 * attacker.level) / 5 + 2) * move.power * (atk / Math.max(1, def)) / 50 + 2,
  );
  const mult = typeMultiplier(move.type, defender.types, chart);
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const variance = 0.85 + rand * 0.15;
  let dmg = Math.floor(base * mult * stab * variance);
  if (mult > 0 && dmg < 1) dmg = 1;
  return { damage: dmg, mult };
}

export function effLabel(mult: number): string {
  if (mult === 0) return "효과가 없는 것 같다…";
  if (mult >= 2) return "효과가 굉장했다!";
  if (mult < 1) return "효과가 별로인 듯하다…";
  return "";
}
