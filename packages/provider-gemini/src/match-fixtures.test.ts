import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isTakeable, type Trigger } from "@beagle/domain";
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

  it("rejects a policy trigger pointed at an unrelated contract", () => {
    const trigger: Trigger = { kind: "policy_event", action: "tariff on imported steel", authority: "USTR", effectiveBy: "2026-12-01" };
    const m = matchCandidate(trigger, btc[0]!, now);
    expect(m.executable).toBe(false);
    expect(m.rejections).toEqual(expect.arrayContaining(["WRONG_EVENT", "WRONG_OUTCOME"]));
  });
});

describe("market state", () => {
  const event = (marketState: string) => ({
    ticker: "BTC2610120000",
    title: "BTC price today at 8pm EDT",
    category: "Crypto",
    contracts: [{ instrumentSymbol: "BTC2610120000-HI83000", ticker: "HI83000", status: "active", marketState, description: "Resolves YES at or above 83000.", strike: { type: "above", value: "83000" } }],
  });

  it("keeps post_only books visible but never takeable", () => {
    const [c] = normalizeEvent(event("post_only") as never, "sandbox");
    expect(c!.marketState).toBe("post_only");
    expect(isTakeable(c!)).toBe(false);
  });

  it("does not throw on a state the schema has not seen", () => {
    const [c] = normalizeEvent(event("halted") as never, "sandbox");
    expect(c!.marketState).toBe("unknown");
    expect(isTakeable(c!)).toBe(false);
  });
});

describe("policy events against production fixtures", () => {
  const now = new Date("2026-10-12T01:00:00Z");
  const fed = normalizeEvent(fixture("production-event-fed.json"), "production");
  const senate = normalizeEvent(fixture("production-event-senate.json"), "production");
  const policy = (action: string, authority: string, effectiveBy: string): Trigger => ({ kind: "policy_event", action, authority, effectiveBy });
  const bucket = (pool: typeof fed, label: string) => pool.find((c) => c.label === label)!;

  it("matches a 25bp cut to the Cut 25bps bucket only", () => {
    const t = policy("Fed cuts rates by 25 basis points", "Federal Reserve", "2026-10-31");
    const hit = matchCandidate(t, bucket(fed, "Cut 25bps"), now);
    expect(hit.checks.find((c) => c.field === "outcome")?.status).toBe("match");
    expect(hit.outcome).toBe("yes");
    // Production is reference only, but the reasons it is not executable are environment, not fit.
    expect(hit.rejections).toEqual(["NOT_EXECUTABLE_IN_ENV"]);
    expect(matchCandidate(t, bucket(fed, "Cut >25bps"), now).rejections).toContain("WRONG_OUTCOME");
    expect(matchCandidate(t, bucket(fed, "Fed maintains rate"), now).rejections).toContain("WRONG_OUTCOME");
  });

  it("reads 'holds' as the maintains bucket and surfaces the cancellation rule", () => {
    const m = matchCandidate(policy("the Fed holds rates steady", "Federal Reserve FOMC", "2026-10-31"), bucket(fed, "Fed maintains rate"), now);
    expect(m.checks.find((c) => c.field === "outcome")?.status).toBe("match");
    expect(m.checks.find((c) => c.field === "decided by date")?.contract).toBe("2026-10-28");
    expect(m.caveats.join(" ")).toMatch(/canceled/);
  });

  it("calls a size-less hike only a partial match for a sized bucket", () => {
    const m = matchCandidate(policy("the Fed raises rates", "Federal Reserve", "2026-10-31"), bucket(fed, "Hike 25bps"), now);
    expect(m.checks.find((c) => c.field === "outcome")?.status).toBe("partial");
  });

  it("rejects a decision that lands after the business needs it", () => {
    const m = matchCandidate(policy("Fed cuts 25bps", "Federal Reserve", "2026-10-20"), bucket(fed, "Cut 25bps"), now);
    expect(m.rejections).toContain("WRONG_DATE");
  });

  it("matches an election winner by candidate and warns about certification", () => {
    const t = policy("Ken Paxton wins the Texas Senate race", "Texas state election authority", "2026-11-30");
    const m = matchCandidate(t, bucket(senate, "Ken Paxton"), now);
    expect(m.checks.find((c) => c.field === "outcome")?.status).toBe("match");
    expect(m.checks.find((c) => c.field === "resolution source")?.contract).toMatch(/state election authority/);
    expect(m.caveats.join(" ")).toMatch(/certified result/);
    expect(matchCandidate(t, bucket(senate, "James Talarico"), now).rejections).toContain("WRONG_OUTCOME");
  });
});
