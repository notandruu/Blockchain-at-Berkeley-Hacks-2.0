import { describe, expect, it } from "vitest";
import type { DepthSnapshot } from "@beagle/domain";
import { isQuoteFresh, quoteOperational, quotePromotion, type QuoteInput } from "./quote.js";
import { PUBLISHED_FEE_SCHEDULE } from "./fees.js";
import { dec } from "./decimal.js";

const now = new Date("2026-10-11T22:00:00.000Z");
const grid = { quantityIncrement: "0.01", quantityMinimum: "0.01", priceIncrement: "0.01", priceMinimum: "0.01" };

function depth(asks: [string, string][], bids: [string, string][] = []): DepthSnapshot {
  return {
    instrumentSymbol: "GEMI-TEST",
    environment: "sandbox",
    asks: asks.map(([price, quantity]) => ({ price, quantity })),
    bids: bids.map(([price, quantity]) => ({ price, quantity })),
    observedAt: now.toISOString(),
    lastUpdateId: "1",
  };
}

const base = (d: DepthSnapshot, over: Partial<QuoteInput> = {}): QuoteInput => ({
  depth: d,
  outcome: "yes",
  grid,
  fees: PUBLISHED_FEE_SCHEDULE,
  priceCeiling: "0.41",
  budgetUsd: "350",
  feeBoundFillUnit: "1",
  now,
  ...over,
});

describe("quotePromotion", () => {
  it("reproduces the PRD fixture with deep liquidity", () => {
    const r = quotePromotion(base(depth([["0.40", "5000"]])), "20", 40);
    expect(r.entitlements).toBe(40);
    expect(r.quote!.quantity).toBe("800.00");
    expect(r.quote!.estimatedPrincipalUsd).toBe("320.00");
    expect(r.quote!.estimatedFeesUsd).toBe("13.44");
    expect(r.quote!.estimatedDebitUsd).toBe("333.44");
    // limit snaps to the worst level used (0.40), so max = 320 + fee ceiling
    expect(dec(r.quote!.maxDebitUsd).lte(350)).toBe(true);
  });

  it("caps entitlements at observed depth instead of extrapolating", () => {
    const r = quotePromotion(base(depth([["0.38", "50"], ["0.40", "75"]])), "20", 40);
    expect(r.reason).toBe("depth");
    expect(r.entitlements).toBe(6); // 125 units / 20 per reward
    expect(r.quote!.quantity).toBe("120.00");
  });

  it("shrinks to the budget using the conservative max debit, not the estimate", () => {
    const r = quotePromotion(base(depth([["0.40", "5000"]]), { budgetUsd: "100" }), "20", 40);
    expect(r.reason).toBe("budget");
    expect(dec(r.quote!.maxDebitUsd).lte(100)).toBe(true);
    // one more reward would breach the budget at the max debit
    const oneMore = quotePromotion(base(depth([["0.40", "5000"]]), { budgetUsd: "10000" }), "20", r.entitlements + 1);
    expect(dec(oneMore.quote!.maxDebitUsd).gt(100)).toBe(true);
  });

  it("returns no quote when nothing is offered under the ceiling", () => {
    const r = quotePromotion(base(depth([["0.55", "1000"]])), "20", 40);
    expect(r.quote).toBeNull();
    expect(r.reason).toBe("no_depth");
  });

  it("prices NO from YES bids", () => {
    const r = quotePromotion(base(depth([], [["0.70", "100"]]), { outcome: "no", priceCeiling: "0.35" }), "10", 5);
    expect(r.quote!.limitPrice).toBe("0.30");
    expect(r.entitlements).toBe(5);
  });
});

describe("quoteOperational", () => {
  it("hedges lost contribution, never more than the book", () => {
    const r = quoteOperational(base(depth([["0.20", "300"]]), { priceCeiling: "0.25" }), "1800");
    expect(r.reason).toBe("depth");
    expect(r.quote!.quantity).toBe("300.00");
  });
});

describe("quote freshness", () => {
  it("expires after the configured age", () => {
    const q = { observedAt: "2026-10-11T21:59:54.000Z" };
    expect(isQuoteFresh(q, now, 5000)).toBe(false);
    expect(isQuoteFresh(q, now, 10000)).toBe(true);
  });
});
