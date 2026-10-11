import { randomUUID } from "node:crypto";
import { isTakeable, planHash, TradePlan } from "@beagle/domain";
import { dec, executableAsks, fillFee, PUBLISHED_FEE_SCHEDULE, usd, walkBook, ZERO } from "@beagle/risk-engine";
import { createPublicClient, fetchDepth, getEventCandidates, type GeminiClient } from "@beagle/provider-gemini";
import type { Sql } from "../db.js";
import { appendEvent } from "../events.js";

export interface QuoteCheck {
  fillable: boolean;
  observedAt: string;
  rulesHashMatches: boolean;
  marketOpen: boolean;
  availableUnderLimit: string;
  estimatedDebitUsd: string | null;
  withinMaxDebit: boolean;
  reason: "OK" | "RULES_CHANGED" | "MARKET_CLOSED" | "INSUFFICIENT_DEPTH" | "OVER_MAX_DEBIT";
}

let publicSandbox: GeminiClient | null = null;
async function sandboxClient(): Promise<GeminiClient> {
  publicSandbox ??= await createPublicClient("sandbox");
  return publicSandbox;
}

// Does the approved plan still execute exactly as written against the book right now?
// Same function before approval (to enable the button) and right before submission.
export async function checkPlanAgainstBook(plan: TradePlan): Promise<QuoteCheck> {
  const client = await sandboxClient();
  const [candidates, depth] = await Promise.all([
    getEventCandidates(client, "sandbox", plan.eventTicker),
    fetchDepth(client, "sandbox", plan.instrumentSymbol),
  ]);
  const c = candidates.find((k) => k.instrumentSymbol === plan.instrumentSymbol);
  const rulesHashMatches = !!c && c.rulesHash === plan.rulesHash;
  const marketOpen = !!c && isTakeable(c);
  const walk = walkBook(executableAsks(depth, plan.outcome), dec(plan.quantity), dec(plan.limitPrice), dec(c?.quantityIncrement ?? "0.01"));
  const fillable = walk.filledQuantity.gte(dec(plan.quantity));
  const fees = walk.fills.reduce((s, f) => s.plus(fillFee(f.quantity, f.price, PUBLISHED_FEE_SCHEDULE)), ZERO);
  const est = walk.principal.plus(fees);
  const withinMaxDebit = est.lte(dec(plan.maxDebitUsd));
  const reason: QuoteCheck["reason"] = !rulesHashMatches ? "RULES_CHANGED" : !marketOpen ? "MARKET_CLOSED" : !fillable ? "INSUFFICIENT_DEPTH" : !withinMaxDebit ? "OVER_MAX_DEBIT" : "OK";
  return {
    fillable: reason === "OK",
    observedAt: depth.observedAt,
    rulesHashMatches,
    marketOpen,
    availableUnderLimit: walk.availableUnderLimit.toString(),
    estimatedDebitUsd: fillable ? usd(est) : null,
    withinMaxDebit,
    reason,
  };
}

export async function refreshPlanCheck(db: Sql, planId: string): Promise<QuoteCheck & { planStatus: string }> {
  const [row] = await db<{ body: { plan: TradePlan }; status: string }[]>`select body, status from plans where id = ${planId}`;
  if (!row) throw new Error("plan not found");
  const check = await checkPlanAgainstBook(TradePlan.parse(row.body.plan));
  await db`update plans set last_quote_check = ${db.json(check as never)} where id = ${planId}`;
  return { ...check, planStatus: row.status };
}

// New immutable version with a fresh limit, quantity and max debit. The old version is
// superseded so its approval (if any) can never apply to the new terms.
export async function supersedeWithFreshQuote(db: Sql, planId: string, reason: string): Promise<string | null> {
  const [row] = await db<{ run_id: string; risk_id: string; plan_group_id: string; version: number; body: { plan: TradePlan; presentation: Record<string, unknown> }; quote_id: string }[]>`
    select run_id, risk_id, plan_group_id, version, body, quote_id from plans where id = ${planId}`;
  if (!row) return null;
  const old = TradePlan.parse(row.body.plan);
  const client = await sandboxClient();
  const candidates = await getEventCandidates(client, "sandbox", old.eventTicker);
  const c = candidates.find((k) => k.instrumentSymbol === old.instrumentSymbol);
  if (!c) return null;
  // Same size, limit and ceiling; re-anchored to the current rules and a new expiry. If the
  // book can no longer fill it, the freshness check keeps the buy button disabled.
  const next: TradePlan = TradePlan.parse({
    ...old,
    id: randomUUID(),
    version: row.version + 1,
    rulesHash: c.rulesHash,
    expiresAt: new Date(Math.min(Date.now() + 30 * 60 * 1000, c.expiryDate ? Date.parse(c.expiryDate) : Infinity)).toISOString(),
  });
  await db.begin(async (tx) => {
    await tx`update plans set status = 'superseded' where id = ${planId} and status in ('proposed', 'approved')`;
    await tx`
      insert into plans (id, plan_group_id, version, run_id, risk_id, quote_id, body, plan_hash, max_debit_usd, expires_at)
      values (${next.id}, ${row.plan_group_id}, ${next.version}, ${row.run_id}, ${row.risk_id}, ${row.quote_id},
        ${tx.json({ plan: next, presentation: row.body.presentation } as never)}, ${planHash(next)}, ${next.maxDebitUsd}, ${next.expiresAt})`;
  });
  await appendEvent(db, row.run_id, {
    type: "approval.required",
    provider: "app",
    mode: "sandbox_exchange",
    title: `New plan version v${next.version}: ${reason}`,
    payload: { planId: next.id, version: next.version, planHash: planHash(next), plan: next, presentation: row.body.presentation, supersedes: planId, reason },
  });
  return next.id;
}
