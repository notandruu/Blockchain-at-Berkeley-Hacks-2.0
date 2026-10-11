import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Trigger } from "@beagle/domain";
import { matchCandidate, rankMatches } from "@beagle/risk-engine";
import { normalizeEvent, type RawEvent } from "./normalize.js";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../fixtures/gemini/${name}`, import.meta.url), "utf8")) as RawEvent;

const now = new Date("2026-10-11T18:00:00.000Z");

describe("matching real Gemini listings", () => {
  const btc = normalizeEvent(fixture("sandbox-event-btc-oct16.json"), "sandbox");
  const nfl = normalizeEvent(fixture("production-event-sports.json"), "production");
  const wx = normalizeEvent(fixture("production-event-weather.json"), "production");

  it("normalizes every contract with a stable rules hash", () => {
    expect(btc.length).toBe(8);
    expect(new Set(btc.map((c) => c.rulesHash)).size).toBe(8);
    expect(normalizeEvent(fixture("sandbox-event-btc-oct16.json"), "sandbox")[0]!.rulesHash).toBe(btc[0]!.rulesHash);
  });

  it("finds an exact executable sandbox match for a BTC threshold promotion", () => {
    const trigger: Trigger = { kind: "price_threshold", asset: "BTC", operator: "gte", threshold: "82000", thresholdUpper: null, observationTime: "2026-10-16T21:00:00.000Z", settlementIndex: null };
    const ranked = rankMatches(btc.map((c) => matchCandidate(trigger, c, now)));
    expect(ranked[0]!.instrumentSymbol).toBe("GEMI-BTC2610162100-HI82000");
    expect(ranked[0]!.matchType).toBe("exact");
    expect(ranked[0]!.outcome).toBe("yes");
    expect(ranked[0]!.executable).toBe(true);
    expect(ranked.filter((r) => r.matchType === "rejected").every((r) => r.rejections.includes("WRONG_THRESHOLD"))).toBe(true);
  });

  it("buys NO when the merchant's trigger is the complement", () => {
    const trigger: Trigger = { kind: "price_threshold", asset: "BTC", operator: "lt", threshold: "82000", thresholdUpper: null, observationTime: "2026-10-16T21:00:00.000Z", settlementIndex: "LS-LRRR-XBTUSD" };
    const m = matchCandidate(trigger, btc.find((c) => c.contractTicker === "HI82000")!, now);
    expect(m.matchType).toBe("exact");
    expect(m.outcome).toBe("no");
  });

  it("rejects a contract that settles at a different time", () => {
    const trigger: Trigger = { kind: "price_threshold", asset: "BTC", operator: "gte", threshold: "82000", thresholdUpper: null, observationTime: "2026-10-12T21:00:00.000Z", settlementIndex: null };
    const m = matchCandidate(trigger, btc.find((c) => c.contractTicker === "HI82000")!, now);
    expect(m.rejections).toContain("WRONG_DATE");
  });

  it("matches the 49ers game but keeps it non-executable and flags the tie rule", () => {
    const trigger: Trigger = { kind: "sports_result", league: "Pro Football", homeTeam: "San Francisco", awayTeam: "Seattle", team: "San Francisco", gameDate: "2026-10-11", scheduledStart: null, period: "final", tieTreatment: "no_reward", cancellationTreatment: "void_promotion" };
    const results = nfl.map((c) => matchCandidate(trigger, c, now));
    const sf = results.find((r) => r.outcome === "yes")!;
    expect(sf.matchType).toBe("proxy");
    expect(sf.executable).toBe(false);
    expect(sf.rejections).toEqual(["NOT_EXECUTABLE_IN_ENV"]);
    expect(sf.checks.find((c) => c.field === "tie")!.status).toBe("partial");
    const sea = results.find((r) => r.instrumentSymbol !== sf.instrumentSymbol)!;
    expect(sea.rejections).toContain("WRONG_TEAM");
  });

  it("maps an 'above 71F' risk at SFO onto the 72-or-above bucket exactly", () => {
    const trigger: Trigger = { kind: "temperature", station: "San Francisco Airport, CA", city: "San Francisco", metric: "daily_high", unit: "F", operator: "gt", threshold: "71", thresholdUpper: null, observationDate: "2026-10-12", timezone: "America/Los_Angeles", source: "NWS" };
    const ranked = rankMatches(wx.map((c) => matchCandidate(trigger, c, now)));
    expect(ranked[0]!.instrumentSymbol).toMatch(/HI72$/);
    expect(ranked[0]!.matchType).toBe("exact");
    expect(ranked[0]!.executable).toBe(false);
  });

  it("downgrades a downtown job site to proxy because the contract settles at SFO", () => {
    const trigger: Trigger = { kind: "temperature", station: "Mission District, San Francisco, CA", city: "San Francisco", metric: "daily_high", unit: "F", operator: "gt", threshold: "71", thresholdUpper: null, observationDate: "2026-10-12", timezone: "America/Los_Angeles", source: "NWS" };
    const m = matchCandidate(trigger, wx.find((c) => c.contractTicker === "HI72")!, now);
    expect(m.matchType).toBe("proxy");
    expect(m.checks.find((c) => c.field === "station")!.status).toBe("partial");
    expect(m.caveats.join(" ")).toContain("San Francisco Airport");
  });

  it("rejects a different city", () => {
    const trigger: Trigger = { kind: "temperature", station: "NWS Climatological Report (Daily) for Oakland, CA", city: "Oakland", metric: "daily_high", unit: "F", operator: "gt", threshold: "71", thresholdUpper: null, observationDate: "2026-10-12", timezone: "America/Los_Angeles", source: "NWS" };
    const m = matchCandidate(trigger, wx.find((c) => c.contractTicker === "HI72")!, now);
    expect(m.matchType).toBe("rejected");
    expect(m.rejections).toContain("WRONG_STATION");
  });

  it("rejects an expired contract", () => {
    const later = new Date("2026-10-20T00:00:00.000Z");
    const trigger: Trigger = { kind: "price_threshold", asset: "BTC", operator: "gte", threshold: "82000", thresholdUpper: null, observationTime: "2026-10-16T21:00:00.000Z", settlementIndex: null };
    expect(matchCandidate(trigger, btc.find((c) => c.contractTicker === "HI82000")!, later).rejections).toContain("EXPIRED");
  });

  it("keeps policy triggers research-only", () => {
    const trigger: Trigger = { kind: "policy_event", action: "tariff on imported steel", authority: "USTR", effectiveBy: "2026-12-01" };
    const m = matchCandidate(trigger, btc[0]!, now);
    expect(m.executable).toBe(false);
    expect(m.rejections).toContain("UNSUPPORTED_TRIGGER");
  });
});
