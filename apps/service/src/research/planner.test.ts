import { describe, expect, it } from "vitest";
import type { Trigger } from "@beagle/domain";
import { rewriteCount, rewriteThreshold } from "./planner.js";

const btc = (threshold: string): Trigger => ({
  kind: "price_threshold",
  asset: "BTC",
  operator: "gte",
  threshold,
  thresholdUpper: null,
  observationTime: "2026-10-12T01:00:00.000Z",
  settlementIndex: null,
});

describe("rewriteThreshold", () => {
  it("moves the agent's prose to the sibling strike the engine actually bought", () => {
    // Text from the live run on 2026-10-12: the headline said $83,900, this still said $83,200.
    const text = "Open a tab tonight before 9pm ET; the first 10 customers to do so get $1 back if Bitcoin is $83,200 or above at 9pm ET";
    expect(rewriteThreshold(text, btc("83200"), btc("83900"))).toContain("$83,900 or above");
    expect(rewriteThreshold(text, btc("83200"), btc("83900"))).not.toContain("83,200");
  });

  it("handles the ungrouped form and leaves other numbers alone", () => {
    expect(rewriteThreshold("BTC at 83200+, tab of $25", btc("83200"), btc("83600"))).toBe("BTC at 83,600+, tab of $25");
    expect(rewriteThreshold("first 832000 visitors", btc("83200"), btc("83600"))).toBe("first 832000 visitors");
  });

  it("is a no-op when the strike did not move", () => {
    expect(rewriteThreshold("Open a tab of $25 or more", btc("83200"), btc("83200"))).toBe("Open a tab of $25 or more");
  });
});

describe("rewriteCount", () => {
  it("matches the promised count to the rewards the fill can pay", () => {
    expect(rewriteCount("the first 10 customers to do so get $1 back", 10, 3)).toBe("the first 3 customers to do so get $1 back");
    expect(rewriteCount("open a tab of $10 or more", 10, 3)).toBe("open a tab of $10 or more");
  });
});
