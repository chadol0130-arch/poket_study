// 순수 배틀 계산 (DB 의존 없음 — 테스트 가능). 데미지/타입상성/스탯 스케일/
// 능력단계/급소/명중. 상태이상은 turn 처리(battle.ts)에서 이 헬퍼들을 쓴다.

import type { StatKey, StatusKind } from "./effects";

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
  accuracy?: number; // 0 또는 미지정 = 반드시 명중
  function_code?: string;
  effect_chance?: number;
}

export type Stages = Record<StatKey, number>;

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
  // 배틀 중 상태(옵션 — 기본 0/없음)
  stages?: Stages;
  status?: StatusKind | null;
  sleepTurns?: number;
  confuseTurns?: number;
  flinched?: boolean;
}

export interface TypeRel {
  weaknesses: string[];
  resistances: string[];
  immunities: string[];
}
export type TypeChart = Record<string, TypeRel>;

export function zeroStages(): Stages {
  return { attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0, accuracy: 0, evasion: 0 };
}

/** 레벨로 스탯 스케일 */
export function scaleStat(base: number, level: number): number {
  return Math.floor(base * (level / 50 + 1));
}
export function maxHpFor(baseHp: number, level: number): number {
  return Math.floor(baseHp * (level / 50 + 1)) + level + 10;
}

/** 공격/방어 능력단계 배수 (-6..+6) */
export function stageMult(stage: number): number {
  const s = Math.max(-6, Math.min(6, stage));
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}
/** 명중/회피 능력단계 배수 */
export function accStageMult(stage: number): number {
  const s = Math.max(-6, Math.min(6, stage));
  return s >= 0 ? (3 + s) / 3 : 3 / (3 - s);
}

/** 공격 타입 vs 방어 포켓몬 타입들 → 효과 배수 */
export function typeMultiplier(moveType: string, defenderTypes: string[], chart: TypeChart): number {
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
  crit: boolean;
}

/** 명중 확률(0..1). move.accuracy<=0 이면 반드시 명중. */
export function hitChance(move: BattleMove, attacker: Combatant, defender: Combatant): number {
  const acc = move.accuracy ?? 100;
  if (acc <= 0) return 1;
  const aStage = attacker.stages?.accuracy ?? 0;
  const eStage = defender.stages?.evasion ?? 0;
  const combined = Math.max(-6, Math.min(6, aStage - eStage));
  return Math.min(1, (acc / 100) * accStageMult(combined));
}

export function computeDamage(
  attacker: Combatant,
  defender: Combatant,
  move: BattleMove,
  chart: TypeChart,
  rand: number = Math.random(),
  crit: boolean = false,
): DamageResult {
  if (move.power <= 0) return { damage: 0, mult: 1, crit: false };
  const physical = move.category !== 1;
  const atkStatKey: keyof Stats = physical ? "attack" : "special_attack";
  const defStatKey: keyof Stats = physical ? "defense" : "special_defense";

  // 능력단계 (급소 시: 공격자 음수단계·방어자 양수단계 무시)
  let atkStage = attacker.stages?.[atkStatKey as StatKey] ?? 0;
  let defStage = defender.stages?.[defStatKey as StatKey] ?? 0;
  if (crit) {
    atkStage = Math.max(0, atkStage);
    defStage = Math.min(0, defStage);
  }
  let atk = attacker.stats[atkStatKey] * stageMult(atkStage);
  const def = defender.stats[defStatKey] * stageMult(defStage);

  // 화상: 물리 공격력 절반
  if (physical && attacker.status === "burn") atk *= 0.5;

  const base = Math.floor(
    (((2 * attacker.level) / 5 + 2) * move.power * (atk / Math.max(1, def))) / 50 + 2,
  );
  const mult = typeMultiplier(move.type, defender.types, chart);
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const critMult = crit ? 1.5 : 1;
  const variance = 0.85 + rand * 0.15;
  let dmg = Math.floor(base * mult * stab * critMult * variance);
  if (mult > 0 && dmg < 1) dmg = 1;
  return { damage: dmg, mult, crit };
}

export function effLabel(mult: number): string {
  if (mult === 0) return "효과가 없는 것 같다…";
  if (mult >= 2) return "효과가 굉장했다!";
  if (mult < 1) return "효과가 별로인 듯하다…";
  return "";
}

/** 마비/능력단계 반영 유효 스피드 (선공 판정용) */
export function effectiveSpeed(c: Combatant): number {
  let sp = c.stats.speed * stageMult(c.stages?.speed ?? 0);
  if (c.status === "paralyze") sp *= 0.25;
  return sp;
}
