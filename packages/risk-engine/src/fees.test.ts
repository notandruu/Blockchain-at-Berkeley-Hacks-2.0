import { describe, expect, it } from "vitest";
import { dec } from "./decimal.js";
import { fillFee, maxVariance, PUBLISHED_FEE_SCHEDULE as S, takerFeeCeiling } from "./fees.js";

describe("fillFee", () => {
  // The four worked examples on gemini.com/fees/predictions.
  it.each([
    ["maker", "0.10", "100", "0.16"],
    ["maker", "0.50", "100", "0.44"],
    ["taker", "0.40", "100", "1.68"],
    ["taker", "0.90", "100", "0.63"],
  ] as const)("%s %s x %s = $%s", (role, p, q, fee) => {
    expect(fillFee(dec(q), dec(p), S, role).toFixed(2)).toBe(fee);
  });

  it("matches the PRD fixture: 800 contracts at 0.40 is $13.44", () => {
    expect(fillFee(dec(800), dec("0.40"), S).toFixed(2)).toBe("13.44");
  });

  it("rounds each fill up independently", () => {
    // 0.07 * 1 * 0.5 * 0.5 = 0.0175 -> 0.02 per fill, so 10 one-lot fills cost more than one 10-lot.
    const tenSingles = Array.from({ length: 10 }, () => fillFee(dec(1), dec("0.5"), S)).reduce((a, b) => a.plus(b));
    expect(tenSingles.toFixed(2)).toBe("0.20");
    expect(fillFee(dec(10), dec("0.5"), S).toFixed(2)).toBe("0.18");
  });
});

describe("takerFeeCeiling", () => {
  it("reproduces the PRD bound: 800 units, limit 0.41, one-contract fills", () => {
    const c = takerFeeCeiling(dec(800), dec("0.01"), dec("0.41"), dec(1), S);
    // PRD: "A conservative per unit taker fee bound of two cents reserves $16"
    expect(c.perFillCeiling.toFixed(2)).toBe("0.02");
    expect(c.ceilingUsd.toFixed(2)).toBe("16.00");
  });

  it("never falls below any actual fragmentation of the order", () => {
    const limit = dec("0.62");
    const ceiling = takerFeeCeiling(dec(30), dec("0.01"), limit, dec(1), S).ceilingUsd;
    // Worst realistic splits at prices up to the limit.
    for (const parts of [[30], [10, 10, 10], Array(30).fill(1), [1, 29], [7, 7, 14, 2]]) {
      for (const p of ["0.50", "0.55", "0.62"]) {
        const actual = parts.reduce((s, q) => s.plus(fillFee(dec(q), dec(p), S)), dec(0));
        expect(actual.lte(ceiling)).toBe(true);
      }
    }
  });

  it("uses p(1-p) at 0.5 when the price range spans it", () => {
    expect(maxVariance(dec("0.2"), dec("0.8")).toString()).toBe("0.25");
    expect(maxVariance(dec("0.01"), dec("0.3")).toString()).toBe("0.21");
  });
});
