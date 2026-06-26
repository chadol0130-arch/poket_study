import { describe, it, expect } from "vitest";
import { levelForXp, xpToReach, levelProgress } from "../xp";

describe("xp curve", () => {
  it("starts at level 1 with no xp", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(-5)).toBe(1);
    expect(xpToReach(1)).toBe(0);
  });

  it("reaches level 2 at 100 xp (base * 1^1.5)", () => {
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
  });

  it("is monotonic — more xp never lowers level", () => {
    let prev = 1;
    for (let xp = 0; xp <= 5000; xp += 50) {
      const lvl = levelForXp(xp);
      expect(lvl).toBeGreaterThanOrEqual(prev);
      prev = lvl;
    }
  });

  it("matches xpToReach boundaries", () => {
    for (let lvl = 2; lvl <= 20; lvl++) {
      const need = xpToReach(lvl);
      expect(levelForXp(need)).toBeGreaterThanOrEqual(lvl);
      expect(levelForXp(need - 1)).toBeLessThan(lvl);
    }
  });

  it("reports progress within a level between 0 and 1", () => {
    const p = levelProgress(150);
    expect(p.level).toBe(2);
    expect(p.pct).toBeGreaterThanOrEqual(0);
    expect(p.pct).toBeLessThanOrEqual(1);
  });
});
