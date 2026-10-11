import { randomUUID } from "node:crypto";
import {
  planHash,
  RiskSpec,
  TradePlan,
  Trigger,
  type MarketCandidate,
} from "@beagle/domain";
import {
  dec,
  matchCandidate,
  operationalScenarios,
  promotionScenarios,
  PUBLISHED_FEE_SCHEDULE,
  quoteOperational,
  quotePromotion,
  rankMatches,
  type MatchResult,
  type Quote,
} from "@beagle/risk-engine";
import { createPublicClient, fetchDepth, getEventCandidates } from "@beagle/provider-gemini";
import type { Sql } from "../db.js";
import { transition } from "../runs.js";
import type { ResearchToolkit } from "./toolkit.js";

export interface PlannerConfig {
  quoteMaxAgeMs: number;
  feeBoundFillUnit: string;
  planTtlMs: number;
}

export interface Proposal {
  mode: "promotion" | "operational";
  title: string;
  trigger: Trigger;
  // Other ways to express the same goal (e.g. a game result instead of a BTC level). They go
  // through the same eligibility checks; the UI shows why each was or was not chosen.
  alternatives: { trigger: Trigger; eventTicker: string | null }[];
  eventTicker: string | null;
  budgetUsd: string;
  priceCeiling: string;
  exposureBasis: string;
  promotion: { rewardUsd: string; maxEntitlements: number; venueName: string; qualification: string; enrollmentClosesAt: string } | null;
  operational: { bookedRevenueUsd: string; avoidedCostsUsd: string; unavoidableCostsUsd: string } | null;
  evidenceIds: string[];
  considerSiblingStrikes: boolean;
}

interface Option {
  candidate: MarketCandidate;
  trigger: Trigger;
  match: MatchResult;
  quote: Quote | null;
  quoteReason: string;
  entitlements: number;
  depth: unknown;
}

const lostContribution = (o: NonNullable<Proposal["operational"]>) => {
  // Lost contribution = booked revenue minus costs avoided by not doing the job.
  const v = dec(o.bookedRevenueUsd).minus(dec(o.avoidedCostsUsd));
  return v.lt(0) ? "0" : v.toFixed(2);
};

// Only compare a trigger with contracts of a compatible category; a BTC level is never
// "rejected" against a football game, it simply is not a candidate for it.
function kindFitsCategory(t: Trigger, c: MarketCandidate): boolean {
  switch (t.kind) {
    case "sports_result":
      return c.category === "Sports";
    case "temperature":
      return c.category === "Weather";
    case "price_threshold":
      return c.category === "Crypto" || c.category === "Commodities";
    case "policy_event":
      return c.category === "Politics" || c.category === "Economics";
  }
}

function withThreshold(t: Trigger, c: MarketCandidate): Trigger | null {
  if (t.kind !== "price_threshold" && t.kind !== "temperature") return t;
  if (!c.strike?.value || (c.strike.type !== "above" && c.strike.type !== "over_or_equal")) return null;
  return { ...t, operator: "gte", threshold: c.strike.value, thresholdUpper: null } as Trigger;
}

export async function planFromProposal(db: Sql, kit: ResearchToolkit, merchantId: string, raw: Proposal, cfg: PlannerConfig) {
  const trigger = Trigger.parse(raw.trigger);
  const alternatives = (raw.alternatives ?? []).map((a) => ({ trigger: Trigger.parse(a.trigger), eventTicker: a.eventTicker }));
  const now = new Date();

  // Pull named events fresh, so we never plan on a stale list.
  const pools: { trigger: Trigger; eventTicker: string | null; pool: MarketCandidate[] }[] = [];
  for (const goal of [{ trigger, eventTicker: raw.eventTicker }, ...alternatives]) {
    let pool = [...kit.candidates.values()];
    if (goal.eventTicker) {
      const fresh: MarketCandidate[] = [];
      for (const env of ["sandbox", "production"] as const) {
        try {
          fresh.push(...(await getEventCandidates(await createPublicClient(env), env, goal.eventTicker)));
        } catch {
          /* not listed in this environment */
        }
      }
      pool = fresh.length ? fresh : pool.filter((c) => c.eventTicker === goal.eventTicker);
    }
    pools.push({ ...goal, pool });
  }
  if (!pools.some((p) => p.pool.length)) throw new Error("no market candidates loaded; call list_market_candidates first");

  // Hard eligibility first, on every candidate for every goal.
  const options: Option[] = [];
  for (const goal of pools) {
    for (const c of goal.pool) {
      const variants: Trigger[] = [goal.trigger];
      if (raw.considerSiblingStrikes && goal.eventTicker && c.eventTicker === goal.eventTicker) {
        const v = withThreshold(goal.trigger, c);
        if (v && JSON.stringify(v) !== JSON.stringify(goal.trigger)) variants.push(v);
      }
      for (const t of variants) {
        if (!kindFitsCategory(t, c)) continue;
        const m = matchCandidate(t, c, now);
        if (t !== goal.trigger && m.matchType === "rejected") continue;
        options.push({ candidate: c, trigger: t, match: m, quote: null, quoteReason: "not_quoted", entitlements: 0, depth: null });
      }
    }
  }

  // Quote every executable option against a fresh sandbox book.
  const sandbox = await createPublicClient("sandbox");
  for (const o of options.filter((x) => x.match.executable && x.match.outcome)) {
    const depth = await fetchDepth(sandbox, "sandbox", o.candidate.instrumentSymbol);
    o.depth = depth;
    const input = {
      depth,
      outcome: o.match.outcome!,
      grid: o.candidate,
      fees: PUBLISHED_FEE_SCHEDULE,
      priceCeiling: raw.priceCeiling,
      budgetUsd: raw.budgetUsd,
      feeBoundFillUnit: cfg.feeBoundFillUnit,
      now: new Date(),
    };
    if (raw.mode === "promotion" && raw.promotion) {
      const q = quotePromotion(input, raw.promotion.rewardUsd, raw.promotion.maxEntitlements);
      o.quote = q.quote;
      o.quoteReason = q.reason;
      o.entitlements = q.entitlements;
    } else if (raw.operational) {
      const q = quoteOperational(input, lostContribution(raw.operational));
      o.quote = q.quote;
      o.quoteReason = q.reason;
    }
  }

  const ranked = rankMatches(options.map((o) => o.match)).map((m) => options.find((o) => o.match === m)!);
  const enrollable = (o: Option) => !o.candidate.expiryDate || Date.parse(o.candidate.expiryDate) - ENROLLMENT_BUFFER_MS > Date.now();
  const executable = ranked.filter((o) => o.quote && (raw.mode !== "promotion" || (o.entitlements > 0 && enrollable(o))));
  // Among quotable options: most covered rewards (or units), then odds nearest a coin flip.
  executable.sort((a, b) => {
    const cap = raw.mode === "promotion" ? b.entitlements - a.entitlements : dec(b.quote!.quantity).comparedTo(dec(a.quote!.quantity));
    if (cap !== 0) return cap;
    const pa = Math.abs(Number(a.quote!.averagePrice ?? 1) - 0.45);
    const pb = Math.abs(Number(b.quote!.averagePrice ?? 1) - 0.45);
    return pa - pb;
  });

  // Persist risk and every match, emit the visible rejections.
  const spec = RiskSpec.parse({
    id: randomUUID(),
    merchantId,
    mode: raw.mode,
    title: raw.title,
    exposureUsd: raw.mode === "promotion" && raw.promotion ? dec(raw.promotion.rewardUsd).mul(raw.promotion.maxEntitlements).toFixed(2) : raw.operational ? lostContribution(raw.operational) : "0",
    exposureBasis: raw.exposureBasis,
    trigger: executable[0]?.trigger ?? trigger,
    eventWindow: {
      startsAt: now.toISOString(),
      endsAt: executable[0]?.candidate.expiryDate ?? ranked[0]?.candidate.expiryDate ?? now.toISOString(),
      timezone: "UTC",
    },
    budgetUsd: raw.budgetUsd,
    priceCeiling: raw.priceCeiling,
    promotion: raw.promotion
      ? { rewardPerEntitlementUsd: raw.promotion.rewardUsd, maxEntitlements: raw.promotion.maxEntitlements, qualification: raw.promotion.qualification, enrollmentClosesAt: raw.promotion.enrollmentClosesAt }
      : null,
    operational: raw.operational ? { ...raw.operational, notes: "" } : null,
    evidenceIds: raw.evidenceIds,
  });
  const [risk] = await db<{ id: string }[]>`
    insert into risks (id, merchant_id, run_id, mode, title, spec, status)
    values (${spec.id}, ${merchantId}, ${kit.runId}, ${spec.mode}, ${spec.title}, ${db.json(spec as never)}, ${executable.length ? "proposed" : "research_only"})
    returning id`;

  for (const o of ranked) {
    await db`
      insert into contract_matches (run_id, risk_id, environment, event_ticker, instrument_symbol, label, match_type, executable, outcome, checks, rejections, caveats, rules_hash, candidate)
      values (${kit.runId}, ${risk!.id}, ${o.candidate.environment}, ${o.candidate.eventTicker}, ${o.candidate.instrumentSymbol}, ${o.candidate.label},
        ${o.match.matchType}, ${o.match.executable}, ${o.match.outcome}, ${db.json(o.match.checks as never)}, ${o.match.rejections}, ${o.match.caveats},
        ${o.candidate.rulesHash}, ${db.json(o.candidate as never)})
      on conflict (run_id, instrument_symbol) do update set match_type = excluded.match_type, executable = excluded.executable, checks = excluded.checks, rejections = excluded.rejections`;
  }

  // Show a handful of informative rejections, not hundreds of strikes.
  const shownRejections = ranked
    .filter((o) => o.match.matchType === "rejected" || !o.match.executable || (o.quote === null && o.match.executable))
    .filter((o) => o !== executable[0])
    .slice(0, 6);
  for (const o of shownRejections) {
    const reasons = o.match.executable && !o.quote ? [o.quoteReason === "no_depth" ? "INSUFFICIENT_DEPTH" : o.quoteReason.toUpperCase()] : o.match.rejections;
    await kit.emit({
      type: "match.rejected",
      provider: "risk_engine",
      mode: "live_research",
      title: `${o.candidate.eventTitle}: ${o.candidate.label}`,
      payload: {
        instrumentSymbol: o.candidate.instrumentSymbol,
        environment: o.candidate.environment,
        matchType: o.match.matchType,
        reasons,
        checks: o.match.checks,
        caveats: o.match.caveats,
        referencePrice: o.candidate.environment === "production" ? (o.match.outcome === "no" ? o.candidate.indicativeBuyNo : o.candidate.indicativeBuyYes) : null,
      },
    });
  }

  const best = executable[0];
  if (!best) {
    const closest = ranked.find((o) => o.match.matchType === "exact" || o.match.matchType === "proxy") ?? null;
    await kit.emit({
      type: "match.rejected",
      provider: "risk_engine",
      mode: "live_research",
      title: "No executable match",
      payload: {
        summary: closest
          ? `${closest.candidate.eventTitle} (${closest.candidate.label}) matches on ${closest.candidate.environment}, but it cannot be bought in this build.`
          : "No listed contract pays on this trigger.",
        closest: closest ? { instrumentSymbol: closest.candidate.instrumentSymbol, environment: closest.candidate.environment, matchType: closest.match.matchType, checks: closest.match.checks, caveats: closest.match.caveats, reasons: closest.match.rejections } : null,
      },
    });
    await transition(db, kit.runId, "QUOTING", "Checking executable quotes");
    await transition(db, kit.runId, "NO_EXECUTABLE_MATCH", "No executable match");
    return { riskId: risk!.id, planId: null, executable: false };
  }

  for (const o of [best]) {
    await kit.emit({
      type: "match.accepted",
      provider: "risk_engine",
      mode: "live_research",
      title: `${o.candidate.eventTitle}: buy ${o.match.outcome!.toUpperCase()} on "${o.candidate.label}"`,
      payload: { instrumentSymbol: o.candidate.instrumentSymbol, matchType: o.match.matchType, checks: o.match.checks, caveats: o.match.caveats, outcome: o.match.outcome },
    });
  }

  await transition(db, kit.runId, "QUOTING", "Quoting against the live sandbox book");
  const q = best.quote!;
  const [quoteRow] = await db<{ id: string }[]>`
    insert into quotes (run_id, instrument_symbol, environment, outcome, depth, body, observed_at)
    values (${kit.runId}, ${best.candidate.instrumentSymbol}, 'sandbox', ${q.outcome}, ${db.json(best.depth as never)}, ${db.json(q as never)}, ${q.observedAt})
    returning id`;
  await kit.emit({
    type: "quote.ready",
    provider: "risk_engine",
    mode: "sandbox_exchange",
    title: `${q.quantity} contracts at up to ${q.limitPrice}, max debit $${q.maxDebitUsd}`,
    payload: { quoteId: quoteRow!.id, quote: q, entitlements: best.entitlements, limitingFactor: q.limitingFactor },
  });

  const planGroupId = randomUUID();
  const plan = buildPlan({ planGroupId, version: 1, riskId: risk!.id, quoteId: quoteRow!.id, best, raw, ttlMs: cfg.planTtlMs });
  const presentation = presentationFor(best, raw);
  const [planRow] = await db<{ id: string }[]>`
    insert into plans (id, plan_group_id, version, run_id, risk_id, quote_id, body, plan_hash, max_debit_usd, expires_at)
    values (${plan.id}, ${planGroupId}, 1, ${kit.runId}, ${risk!.id}, ${quoteRow!.id},
      ${db.json({ plan, presentation } as never)}, ${planHash(plan)}, ${plan.maxDebitUsd}, ${plan.expiresAt})
    returning id`;
  await transition(db, kit.runId, "AWAITING_APPROVAL", "Plan ready for approval");
  await kit.emit({
    type: "approval.required",
    provider: "app",
    mode: "sandbox_exchange",
    title: `Approve up to $${plan.maxDebitUsd} on Gemini`,
    payload: { planId: planRow!.id, version: 1, planHash: planHash(plan), plan, presentation },
  });
  return { riskId: risk!.id, planId: planRow!.id, executable: true };
}

// Enrollment shuts this long before the contract observes its outcome, so nobody can sign up
// once the answer is effectively known. An hour was too long: it closed every promotion on
// the hourly sandbox contracts before it opened.
export const ENROLLMENT_BUFFER_MS = 5 * 60 * 1000;

export function buildPlan(a: { planGroupId: string; version: number; riskId: string; quoteId: string; best: Option; raw: Proposal; ttlMs: number }): TradePlan {
  const q = a.best.quote!;
  const expiry = a.best.candidate.expiryDate ? Date.parse(a.best.candidate.expiryDate) : Date.now() + a.ttlMs;
  const promo = a.raw.promotion;
  return TradePlan.parse({
    id: randomUUID(),
    version: a.version,
    riskId: a.riskId,
    environment: "sandbox",
    instrumentSymbol: a.best.candidate.instrumentSymbol,
    eventTicker: a.best.candidate.eventTicker,
    outcome: a.best.match.outcome,
    quantity: q.quantity,
    limitPrice: q.limitPrice,
    estimatedDebitUsd: q.estimatedDebitUsd,
    maxDebitUsd: q.maxDebitUsd,
    matchType: a.best.match.matchType,
    quoteId: a.quoteId,
    rulesHash: a.best.candidate.rulesHash,
    timeInForce: "fill-or-kill",
    minAcceptableQuantity: q.quantity,
    campaign: promo
      ? {
          rewardPerEntitlementUsd: promo.rewardUsd,
          maxEntitlements: a.best.entitlements,
          headline: campaignHeadline(a.best, promo.rewardUsd),
          qualification: promo.qualification,
          enrollmentClosesAt: new Date(Math.min(Date.parse(promo.enrollmentClosesAt), expiry - ENROLLMENT_BUFFER_MS)).toISOString(),
        }
      : null,
    // A plan cannot outlive its approval window or the contract.
    expiresAt: new Date(Math.min(Date.now() + a.ttlMs, expiry)).toISOString(),
  });
}

function campaignHeadline(o: Option, reward: string): string {
  const t = o.trigger;
  if (t.kind === "price_threshold") {
    const when = new Date(t.observationTime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", timeZone: "America/New_York", timeZoneName: "short" });
    const thr = Number(t.threshold).toLocaleString("en-US");
    return `If ${t.asset} is at or above $${thr} on ${when}, get $${Number(reward)} back on your tab`;
  }
  if (t.kind === "sports_result") return `If ${t.team} win, get $${Number(reward)} back on your tab`;
  return `$${Number(reward)} back if ${o.candidate.label}`;
}

function presentationFor(o: Option, raw: Proposal) {
  const q = o.quote!;
  const scenarios =
    raw.mode === "promotion" && raw.promotion
      ? promotionScenarios({ heldPayoutUnits: q.quantity, costUsd: q.estimatedDebitUsd, rewardUsd: raw.promotion.rewardUsd, claimedEntitlements: Math.floor(o.entitlements / 2), maxEntitlements: o.entitlements })
      : operationalScenarios({ heldPayoutUnits: q.quantity, costUsd: q.estimatedDebitUsd, lostContributionUsd: raw.operational ? lostContribution(raw.operational) : "0" });
  return {
    eventTitle: o.candidate.eventTitle,
    contractLabel: o.candidate.label,
    termsUrl: o.candidate.termsUrl,
    settlementSource: o.candidate.settlementSource,
    expiryDate: o.candidate.expiryDate,
    checks: o.match.checks,
    caveats: o.match.caveats,
    entitlements: o.entitlements,
    requestedEntitlements: raw.promotion?.maxEntitlements ?? null,
    limitingFactor: q.limitingFactor,
    feeAssumption: q.feeAssumption,
    quote: q,
    scenarios,
    venueName: raw.promotion?.venueName ?? null,
  };
}
