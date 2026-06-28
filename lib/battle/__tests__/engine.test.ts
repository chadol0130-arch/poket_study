import { describe, it, expect } from "vitest";
import {
  typeMultiplier,
  computeDamage,
  type TypeChart,
  type Combatant,
} from "../engine";

const chart: TypeChart = {
  fire: { weaknesses: ["water"], resistances: ["grass"], immunities: [] },
  ground: { weaknesses: ["water"], resistances: [], immunities: ["electric"] },
};

describe("typeMultiplier", () => {
  it("super effective ×2 on weakness", () => {
    expect(typeMultiplier("water", ["fire"], chart)).toBe(2);
  });
  it("not very effective ×0.5 on resistance", () => {
    expect(typeMultiplier("grass", ["fire"], chart)).toBe(0.5);
  });
  it("immune ×0", () => {
    expect(typeMultiplier("electric", ["ground"], chart)).toBe(0);
  });
  it("neutral ×1 for unknown", () => {
    expect(typeMultiplier("normal", ["fire"], chart)).toBe(1);
  });
  it("dual type multiplies", () => {
    expect(typeMultiplier("water", ["fire", "ground"], chart)).toBe(4);
  });
});

function mk(over: Partial<Combatant> = {}): Combatant {
  return {
    speciesId: "x",
    name: "t",
    level: 20,
    types: ["normal"],
    stats: { hp: 50, attack: 50, defense: 50, special_attack: 50, special_defense: 50, speed: 50 },
    maxHp: 60,
    hp: 60,
    moves: [],
    spriteUrl: null,
    ...over,
  };
}

describe("computeDamage", () => {
  it("status move (power 0) deals no damage", () => {
    const r = computeDamage(mk(), mk(), { key: "g", name_ko: "g", power: 0, type: "normal", category: 2 }, chart, 1);
    expect(r.damage).toBe(0);
  });
  it("damaging move deals >=1 and applies weakness", () => {
    const atk = mk({ types: ["water"] });
    const def = mk({ types: ["fire"] });
    const neutralDef = mk({ types: ["normal"] });
    const sup = computeDamage(atk, def, { key: "w", name_ko: "w", power: 60, type: "water", category: 1 }, chart, 1);
    const neu = computeDamage(atk, neutralDef, { key: "w", name_ko: "w", power: 60, type: "water", category: 1 }, chart, 1);
    expect(sup.damage).toBeGreaterThan(neu.damage); // 약점이 더 아프다
    expect(sup.mult).toBe(2);
  });
});
