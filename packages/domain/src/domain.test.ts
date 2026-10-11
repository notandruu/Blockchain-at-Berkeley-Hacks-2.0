import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, IllegalTransitionError } from "./state-machine.js";
import { canonicalJson, planHash, type TradePlan } from "./plan.js";
import { Trigger } from "./triggers.js";

const plan: TradePlan = {
  id: "plan_1",
  version: 1,
  riskId: "risk_1",
  environment: "sandbox",
  instrumentSymbol: "GEMI-BTC2610162100-HI80500",
  eventTicker: "BTC2610162100",
  outcome: "yes",
  quantity: "100",
  limitPrice: "0.41",
  estimatedDebitUsd: "41.00",
  maxDebitUsd: "43.00",
  matchType: "exact",
  quoteId: "q_1",
  rulesHash: "abc",
  timeInForce: "fill-or-kill",
  minAcceptableQuantity: "100",
  campaign: null,
  expiresAt: "2026-10-16T20:00:00.000Z",
};

describe("run state machine", () => {
  it("allows the happy path", () => {
    const path = ["DRAFT", "RESEARCHING", "MATCHING", "QUOTING", "AWAITING_APPROVAL", "APPROVED", "SUBMITTING", "RECONCILING", "ACTIVE"] as const;
    for (let i = 1; i < path.length; i++) expect(canTransition(path[i - 1]!, path[i]!)).toBe(true);
  });

  it("refuses to skip approval", () => {
    expect(() => assertTransition("AWAITING_APPROVAL", "SUBMITTING")).toThrow(IllegalTransitionError);
  });

  it("only leaves EXECUTION_UNKNOWN through reconciliation", () => {
    expect(canTransition("EXECUTION_UNKNOWN", "SUBMITTING")).toBe(false);
    expect(canTransition("EXECUTION_UNKNOWN", "RECONCILING")).toBe(true);
  });
});

describe("plan hash", () => {
  it("ignores key order", () => {
    const shuffled = Object.fromEntries(Object.entries(plan).reverse()) as TradePlan;
    expect(planHash(shuffled)).toBe(planHash(plan));
  });

  it("changes when any economic field changes", () => {
    expect(planHash({ ...plan, quantity: "101" })).not.toBe(planHash(plan));
    expect(planHash({ ...plan, limitPrice: "0.42" })).not.toBe(planHash(plan));
  });

  it("serializes nested values canonically", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: null } })).toBe('{"a":{"c":null,"d":[2,1]},"b":1}');
  });
});

describe("trigger union", () => {
  it("rejects a temperature trigger with no station", () => {
    const r = Trigger.safeParse({ kind: "temperature", city: "San Francisco", metric: "daily_high", unit: "F", operator: "gt", threshold: "80", thresholdUpper: null, observationDate: "2026-10-12", timezone: "America/Los_Angeles", source: "NWS" });
    expect(r.success).toBe(false);
  });
});
