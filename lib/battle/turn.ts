// 한 라운드(양측 1행동) 해석 — 어나더레드급 규칙. 순수 함수(rng 주입)라 테스트 가능.
// 선공=스피드, 명중/빗나감, 급소, 연속공격, 반동/흡수, 능력변화, 상태이상(독/화상/
// 마비/잠듦/얼음/혼란), 풀린치, 턴 종료 도트 데미지.

import {
  type Combatant,
  type BattleMove,
  type TypeChart,
  computeDamage,
  effLabel,
  hitChance,
  effectiveSpeed,
  zeroStages,
} from "./engine";
import { parseEffect, STATUS_KO, STAT_KO, type StatusKind, type StatKey } from "./effects";

export type Outcome = "ongoing" | "won" | "lost";

export interface RoundResult {
  student: Combatant;
  enemy: Combatant;
  log: string[];
  status: Outcome;
}

type RNG = () => number;
const CRIT_CHANCE = 1 / 16;

function ensure(c: Combatant): Combatant {
  if (!c.stages) c.stages = zeroStages();
  if (c.status === undefined) c.status = null;
  return c;
}

function applyStatChange(
  target: Combatant,
  stat: StatKey,
  stages: number,
  log: string[],
) {
  const cur = target.stages![stat] ?? 0;
  const next = Math.max(-6, Math.min(6, cur + stages));
  if (next === cur) {
    log.push(`${target.name}의 ${STAT_KO[stat]}은(는) 더 이상 변하지 않는다!`);
    return;
  }
  target.stages![stat] = next;
  const up = stages > 0;
  const big = Math.abs(stages) >= 2;
  log.push(`${target.name}의 ${STAT_KO[stat]}이(가) ${big ? "크게 " : ""}${up ? "올라갔다!" : "떨어졌다!"}`);
}

function applyStatus(target: Combatant, kind: StatusKind, rng: RNG, log: string[]) {
  if (kind === "confuse") {
    if ((target.confuseTurns ?? 0) > 0) return;
    target.confuseTurns = 2 + Math.floor(rng() * 3); // 2~4
    log.push(`${target.name}은(는) 혼란에 빠졌다!`);
    return;
  }
  if (target.status) {
    return; // 이미 상태이상 — 중첩 불가(조용히 실패)
  }
  target.status = kind;
  if (kind === "sleep") target.sleepTurns = 1 + Math.floor(rng() * 3); // 1~3
  log.push(`${target.name}은(는) ${STATUS_KO[kind]} 상태가 되었다!`);
}

// 공격자가 한 번 행동
function act(
  attacker: Combatant,
  defender: Combatant,
  move: BattleMove,
  chart: TypeChart,
  rng: RNG,
  log: string[],
) {
  // 풀린치
  if (attacker.flinched) {
    attacker.flinched = false;
    log.push(`${attacker.name}은(는) 풀이 죽어 움직이지 못했다!`);
    return;
  }
  // 잠듦
  if (attacker.status === "sleep") {
    attacker.sleepTurns = (attacker.sleepTurns ?? 1) - 1;
    if (attacker.sleepTurns > 0) {
      log.push(`${attacker.name}은(는) 쿨쿨 자고 있다.`);
      return;
    }
    attacker.status = null;
    log.push(`${attacker.name}은(는) 잠에서 깨어났다!`);
  }
  // 얼음
  if (attacker.status === "freeze") {
    if (rng() < 0.2) {
      attacker.status = null;
      log.push(`${attacker.name}의 얼음이 녹았다!`);
    } else {
      log.push(`${attacker.name}은(는) 얼어붙어 움직일 수 없다!`);
      return;
    }
  }
  // 마비
  if (attacker.status === "paralyze" && rng() < 0.25) {
    log.push(`${attacker.name}은(는) 몸이 저려 움직일 수 없다!`);
    return;
  }
  // 혼란
  if ((attacker.confuseTurns ?? 0) > 0) {
    attacker.confuseTurns = (attacker.confuseTurns ?? 0) - 1;
    if (attacker.confuseTurns <= 0) {
      log.push(`${attacker.name}의 혼란이 풀렸다!`);
    } else if (rng() < 1 / 3) {
      // 자기 자신을 때림 (무속성 물리, 위력 40 가정)
      const self = computeDamage(
        attacker,
        attacker,
        { key: "CONFUSE", name_ko: "혼란", power: 40, type: "___", category: 0 },
        chart,
        rng(),
      );
      attacker.hp = Math.max(0, attacker.hp - self.damage);
      log.push(`${attacker.name}은(는) 혼란에 빠져 자신을 공격했다! (${self.damage})`);
      return;
    }
  }

  const eff = parseEffect(move.function_code);

  // 명중 판정
  if (rng() >= hitChance(move, attacker, defender)) {
    log.push(`${attacker.name}의 ${move.name_ko}! 하지만 빗나갔다…`);
    return;
  }

  if (move.power > 0) {
    // 공격기술
    const hits = eff.multiHit ? eff.multiHit.min + Math.floor(rng() * (eff.multiHit.max - eff.multiHit.min + 1)) : 1;
    let total = 0;
    let lastMult = 1;
    let critAny = false;
    for (let i = 0; i < hits && defender.hp > 0; i++) {
      const crit = rng() < CRIT_CHANCE;
      const r = computeDamage(attacker, defender, move, chart, rng(), crit);
      defender.hp = Math.max(0, defender.hp - r.damage);
      total += r.damage;
      lastMult = r.mult;
      critAny = critAny || crit;
    }
    const extra = [
      critAny ? "급소에 맞았다!" : "",
      effLabel(lastMult),
      hits > 1 ? `${hits}번 맞았다!` : "",
    ]
      .filter(Boolean)
      .join(" ");
    log.push(`${attacker.name}의 ${move.name_ko}! (${total}) ${extra}`.trim());

    // 반동 / 흡수
    if (eff.recoil > 0 && total > 0) {
      const rec = Math.max(1, Math.floor(total * eff.recoil));
      attacker.hp = Math.max(0, attacker.hp - rec);
      log.push(`${attacker.name}은(는) 반동으로 ${rec}의 데미지를 입었다.`);
    }
    if (eff.heal === "leech" && total > 0) {
      const heal = Math.max(1, Math.floor(total / 2));
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
      log.push(`${attacker.name}은(는) ${heal}만큼 HP를 흡수했다!`);
    }

    // 부가효과 (effect_chance%)
    if (lastMult > 0 && defender.hp > 0) {
      const chance = move.effect_chance ?? 0;
      if (chance > 0 && rng() * 100 < chance) {
        applySecondary(eff, attacker, defender, rng, log);
      }
    }
  } else {
    // 변화기술 — 100% 적용
    let did = false;
    if (eff.heal === "half") {
      const heal = Math.floor(attacker.maxHp / 2);
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
      log.push(`${attacker.name}은(는) ${move.name_ko}! HP를 ${heal} 회복했다!`);
      did = true;
    }
    if (eff.statChanges.length || eff.status) {
      log.push(`${attacker.name}의 ${move.name_ko}!`);
      applySecondary(eff, attacker, defender, rng, log);
      did = true;
    }
    if (!did) log.push(`${attacker.name}의 ${move.name_ko}! 하지만 효과가 없었다…`);
  }
}

function applySecondary(
  eff: ReturnType<typeof parseEffect>,
  attacker: Combatant,
  defender: Combatant,
  rng: RNG,
  log: string[],
) {
  for (const sc of eff.statChanges) {
    const tgt = sc.target === "user" ? attacker : defender;
    applyStatChange(tgt, sc.stat, sc.stages, log);
  }
  if (eff.status) {
    const tgt = eff.statusTarget === "user" ? attacker : defender;
    applyStatus(tgt, eff.status, rng, log);
  }
  if (eff.flinch) defender.flinched = true;
}

function endOfTurn(c: Combatant, log: string[]) {
  if (c.hp <= 0) return;
  if (c.status === "poison" || c.status === "badpoison" || c.status === "burn") {
    const dmg = Math.max(1, Math.floor(c.maxHp / 8));
    c.hp = Math.max(0, c.hp - dmg);
    const label = c.status === "burn" ? "화상" : "독";
    log.push(`${c.name}은(는) ${label} 데미지를 입었다! (${dmg})`);
  }
}

/** 아이템 사용/포획 실패 후 적만 1회 행동(도트 포함). 학생은 행동하지 않는다. */
export function enemyFreeAttack(
  studentIn: Combatant,
  enemyIn: Combatant,
  chart: TypeChart,
  rng: RNG = Math.random,
): RoundResult {
  const student = ensure({ ...studentIn, stages: { ...(studentIn.stages ?? zeroStages()) } });
  const enemy = ensure({ ...enemyIn, stages: { ...(enemyIn.stages ?? zeroStages()) } });
  const log: string[] = [];

  const ePool = enemy.moves.length ? enemy.moves : [{ key: "STRUGGLE", name_ko: "발버둥", power: 30, type: "normal", category: 0 }];
  const eMove = ePool[Math.floor(rng() * ePool.length)];
  if (enemy.hp > 0 && student.hp > 0) act(enemy, student, eMove, chart, rng, log);

  if (student.hp > 0 && enemy.hp > 0) {
    endOfTurn(student, log);
    endOfTurn(enemy, log);
  }

  let status: Outcome = "ongoing";
  if (enemy.hp <= 0) {
    log.push(`${enemy.name}을(를) 쓰러뜨렸다!`);
    status = "won";
  } else if (student.hp <= 0) {
    log.push(`${student.name}이(가) 쓰러졌다…`);
    status = "lost";
  }

  return { student, enemy, log, status };
}

/** 학생 기술키로 한 라운드 진행. enemyMoveKey 없으면 적 기술 랜덤. */
export function resolveRound(
  studentIn: Combatant,
  enemyIn: Combatant,
  studentMoveKey: string,
  chart: TypeChart,
  rng: RNG = Math.random,
  enemyMoveKey?: string,
): RoundResult {
  const student = ensure({ ...studentIn, stages: { ...(studentIn.stages ?? zeroStages()) } });
  const enemy = ensure({ ...enemyIn, stages: { ...(enemyIn.stages ?? zeroStages()) } });
  const log: string[] = [];

  const sMove = student.moves.find((m) => m.key === studentMoveKey) ?? student.moves[0];
  const ePool = enemy.moves.length ? enemy.moves : [{ key: "STRUGGLE", name_ko: "발버둥", power: 30, type: "normal", category: 0 }];
  const eMove = enemyMoveKey
    ? ePool.find((m) => m.key === enemyMoveKey) ?? ePool[0]
    : ePool[Math.floor(rng() * ePool.length)];

  // 선공: 스피드 (동률 랜덤)
  const sFirst =
    effectiveSpeed(student) > effectiveSpeed(enemy) ||
    (effectiveSpeed(student) === effectiveSpeed(enemy) && rng() < 0.5);

  const order: ("s" | "e")[] = sFirst ? ["s", "e"] : ["e", "s"];
  for (const who of order) {
    if (student.hp <= 0 || enemy.hp <= 0) break;
    if (who === "s") act(student, enemy, sMove, chart, rng, log);
    else act(enemy, student, eMove, chart, rng, log);
  }

  // 턴 종료 도트
  if (student.hp > 0 && enemy.hp > 0) {
    endOfTurn(student, log);
    endOfTurn(enemy, log);
  }

  let status: Outcome = "ongoing";
  if (enemy.hp <= 0) {
    log.push(`${enemy.name}을(를) 쓰러뜨렸다!`);
    status = "won";
  } else if (student.hp <= 0) {
    log.push(`${student.name}이(가) 쓰러졌다…`);
    status = "lost";
  }

  return { student, enemy, log, status };
}
