import { describe, it, expect } from "vitest";
import { parseEffect } from "../effects";
import { stageMult, accStageMult, type Combatant, type TypeChart } from "../engine";
import { resolveRound } from "../turn";

describe("parseEffect", () => {
  it("stat lower (울음소리=공격↓1)", () => {
    const e = parseEffect("LowerTargetAttack1");
    expect(e.statChanges).toEqual([{ stat: "attack", stages: -1, target: "target" }]);
  });
  it("stat raise 2 (칼춤=공격↑2)", () => {
    const e = parseEffect("RaiseUserAttack2");
    expect(e.statChanges).toEqual([{ stat: "attack", stages: 2, target: "user" }]);
  });
  it("status (수면가루=잠듦)", () => {
    expect(parseEffect("SleepTarget").status).toBe("sleep");
  });
  it("combined stats (RaiseUserSpAtkSpDefSpd1)", () => {
    const e = parseEffect("RaiseUserSpAtkSpDefSpd1");
    const stats = e.statChanges.map((s) => s.stat).sort();
    expect(stats).toEqual(["special_attack", "special_defense", "speed"]);
    expect(e.statChanges.every((s) => s.stages === 1 && s.target === "user")).toBe(true);
  });
  it("multi-hit + recoil + heal", () => {
    expect(parseEffect("HitTwoToFiveTimes").multiHit).toEqual({ min: 2, max: 5 });
    expect(parseEffect("RecoilThirdOfDamageDealt").recoil).toBeCloseTo(1 / 3);
    expect(parseEffect("HealUserHalfOfTotalHP").heal).toBe("half");
  });
  it("None → empty", () => {
    expect(parseEffect("None").status).toBeNull();
    expect(parseEffect("None").statChanges).toEqual([]);
  });
});

describe("stage multipliers", () => {
  it("atk/def stage", () => {
    expect(stageMult(0)).toBe(1);
    expect(stageMult(2)).toBe(2);
    expect(stageMult(-2)).toBe(0.5);
  });
  it("accuracy/evasion stage", () => {
    expect(accStageMult(0)).toBe(1);
    expect(accStageMult(3)).toBe(2);
  });
});

const chart: TypeChart = {
  fire: { weaknesses: ["water"], resistances: [], immunities: [] },
};

function mk(over: Partial<Combatant> = {}): Combatant {
  return {
    speciesId: "x",
    name: "t",
    level: 20,
    types: ["normal"],
    stats: { hp: 50, attack: 60, defense: 50, special_attack: 50, special_defense: 50, speed: 50 },
    maxHp: 80,
    hp: 80,
    moves: [{ key: "TACKLE", name_ko: "몸통박치기", power: 50, type: "normal", category: 0, accuracy: 100 }],
    spriteUrl: null,
    ...over,
  };
}

// 결정적 rng: 항상 0 반환 → 명중(0<hit), 급소 안 뜸(0<1/16? 0<0.0625 true!) ...
// 급소를 피하려면 0.5 반환 rng 사용
const rng = () => 0.5;

describe("resolveRound", () => {
  it("기본 공격으로 데미지를 주고받는다", () => {
    const s = mk({ name: "내포켓몬", speciesId: "s" });
    const e = mk({ name: "적", speciesId: "e", stats: { ...mk().stats, speed: 10 } });
    const r = resolveRound(s, e, "TACKLE", chart, rng);
    expect(r.enemy.hp).toBeLessThan(e.maxHp); // 적이 맞음
    expect(r.status).toBe("ongoing");
    expect(r.log.length).toBeGreaterThan(0);
  });

  it("변화기술(칼춤)은 자신의 공격 단계를 올린다", () => {
    const s = mk({
      moves: [{ key: "SD", name_ko: "칼춤", power: 0, type: "normal", category: 2, function_code: "RaiseUserAttack2" }],
    });
    const e = mk({ stats: { ...mk().stats, speed: 1 } });
    const r = resolveRound(s, e, "SD", chart, rng);
    expect(r.student.stages?.attack).toBe(2);
  });

  it("스피드가 높으면 선공한다(적 먼저 못 때림)", () => {
    const fast = mk({ name: "빠름", stats: { ...mk().stats, speed: 200 } });
    const slow = mk({ name: "느림", stats: { ...mk().stats, speed: 1 }, hp: 5, maxHp: 80 });
    // 빠른 학생이 먼저 때려 느린 적을 쓰러뜨리면 적은 반격 못 함
    const r = resolveRound(fast, { ...slow, hp: 1 }, "TACKLE", chart, rng);
    expect(r.status).toBe("won");
  });
});
