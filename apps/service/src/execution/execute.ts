import { randomBytes } from "node:crypto";
import { TradePlan, type RunState } from "@riskpilot/domain";
import { dec, fillFee, PUBLISHED_FEE_SCHEDULE, usd, ZERO } from "@riskpilot/risk-engine";
import {
  findSubmittedOrder,
  getTermsStatus,
  listOrderHistory,
  listPositions,
  submitApprovedOrder,
  type ExchangeOrder,
  type FillLedger,
  type GeminiClient,
} from "@riskpilot/provider-gemini";
import type { Sql } from "../db.js";
import { appendEvent } from "../events.js";
import { enqueue, type Job } from "../jobs.js";
import { transition } from "../runs.js";
import { ACCOUNT_LANE, SANDBOX_ACCOUNT_ID } from "./approve.js";
import { checkPlanAgainstBook, supersedeWithFreshQuote } from "./quote-check.js";

interface OrderRow {
  id: string;
  approval_id: string;
  plan_id: string;
  symbol: string;
  outcome: "yes" | "no";
  quantity: string;
  limit_price: string;
  time_in_force: "fill-or-kill" | "immediate-or-cancel";
  state: string;
  exchange_order_id: string | null;
  submitted_at: Date | null;
  run_id: string;
  merchant_id: string;
  body: { plan: TradePlan; presentation: { venueName?: string | null } };
}

export interface ExecutionDeps {
  db: Sql;
  trading: () => Promise<GeminiClient>;
  // Fills (with exchange-reported fees) captured from the authenticated order stream.
  ledgers: Map<string, FillLedger>;
  quoteMaxAgeMs: number;
}

async function loadOrder(db: Sql, orderId: string): Promise<OrderRow | null> {
  const [o] = await db<OrderRow[]>`
    select o.*, p.run_id, r.merchant_id, p.body
    from exchange_orders o join plans p on p.id = o.plan_id join runs r on r.id = p.run_id
    where o.id = ${orderId}`;
  return o ?? null;
}

async function releaseReservation(db: Sql, approvalId: string): Promise<void> {
  await db`update budget_reservations set status = 'released', updated_at = now() where approval_id = ${approvalId} and status = 'held'`;
}

async function unblockAccount(db: Sql, orderId: string): Promise<void> {
  await db`update exchange_accounts set blocked_by_order_id = null, blocked_reason = null, updated_at = now() where id = ${SANDBOX_ACCOUNT_ID} and blocked_by_order_id = ${orderId}`;
}

export function executeOrderHandler(deps: ExecutionDeps) {
  return async (job: Job): Promise<void> => {
    const { db } = deps;
    const orderId = String(job.payload.orderId);
    const o = await loadOrder(db, orderId);
    // Exactly-once from our side: only a 'pending' order is ever sent. A re-delivered job
    // finds 'submitting' or later and goes to reconciliation instead.
    if (!o) return;
    if (o.state !== "pending") {
      if (o.state === "submitting" || o.state === "unknown") await enqueue(db, "reconcile_order", o.run_id, { orderId }, { lane: ACCOUNT_LANE, maxAttempts: 30 });
      return;
    }
    const plan = TradePlan.parse(o.body.plan);

    // Revalidate everything the approval assumed, without asking the model.
    const client = await deps.trading();
    const terms = await getTermsStatus(client);
    const check = await checkPlanAgainstBook(plan);
    const failure = !terms.hasAcceptedLatest ? "TERMS_NOT_ACCEPTED" : check.reason !== "OK" ? check.reason : null;
    if (failure) {
      await db`update exchange_orders set state = 'rejected', reject_code = ${failure}, reject_message = 'pre-submit revalidation failed' where id = ${orderId}`;
      await releaseReservation(db, o.approval_id);
      await db`update plans set status = 'invalidated' where id = ${o.plan_id}`;
      await appendEvent(db, o.run_id, {
        type: "quote.stale",
        provider: "risk_engine",
        mode: "sandbox_exchange",
        title: failure === "TERMS_NOT_ACCEPTED" ? "Exchange terms need the account owner's acceptance" : `Not submitted: ${failure.replaceAll("_", " ").toLowerCase()}`,
        payload: { code: failure, check },
      });
      await transition(db, o.run_id, "QUOTING", "Back to review: conditions changed before submission", { code: failure });
      if (failure !== "TERMS_NOT_ACCEPTED") await supersedeWithFreshQuote(db, o.plan_id, "conditions changed before submission");
      await transition(db, o.run_id, "AWAITING_APPROVAL", "Waiting for a fresh approval");
      return;
    }

    // Take the account's single mutation lane.
    const locked = await db`
      update exchange_accounts set blocked_by_order_id = ${orderId}, blocked_reason = 'SUBMITTING', updated_at = now()
      where id = ${SANDBOX_ACCOUNT_ID} and blocked_by_order_id is null returning id`;
    if (!locked.length) throw new Error("account busy");

    await db`update exchange_orders set state = 'submitting', submitted_at = now() where id = ${orderId}`;
    await transition(db, o.run_id, "SUBMITTING", "Submitting order");
    await appendEvent(db, o.run_id, {
      type: "order.submitted",
      provider: "gemini_markets",
      mode: "sandbox_exchange",
      title: "Order submitted",
      payload: { orderId, symbol: o.symbol, outcome: o.outcome, quantity: o.quantity, limitPrice: o.limit_price, timeInForce: o.time_in_force, estimatedDebitUsd: check.estimatedDebitUsd },
    });

    const res = await submitApprovedOrder(client, {
      symbol: o.symbol,
      outcome: o.outcome,
      quantity: plan.quantity,
      limitPrice: plan.limitPrice,
      timeInForce: o.time_in_force,
    });

    if (res.kind === "accepted") {
      await db`
        update exchange_orders set state = 'accepted', exchange_order_id = ${res.orderId}, exchange_status = ${res.status},
          response = ${db.json(res.raw as never)} where id = ${orderId}`;
      await transition(db, o.run_id, "RECONCILING", "Confirming fills with the exchange", { exchangeOrderId: res.orderId });
      await reconcileOrder(deps, orderId);
      return;
    }
    if (res.kind === "rejected") {
      await db`update exchange_orders set state = 'rejected', reject_code = ${res.code}, reject_message = ${res.message} where id = ${orderId}`;
      await releaseReservation(db, o.approval_id);
      await unblockAccount(db, orderId);
      await appendEvent(db, o.run_id, {
        type: "order.no_fill",
        provider: "gemini_markets",
        mode: "sandbox_exchange",
        title: `Exchange refused the order: ${res.code}`,
        payload: { orderId, code: res.code, message: res.message, httpStatus: res.httpStatus },
      });
      await transition(db, o.run_id, "QUOTING", "Order refused; review again", { code: res.code });
      await supersedeWithFreshQuote(db, o.plan_id, `exchange refused: ${res.code}`);
      await transition(db, o.run_id, "AWAITING_APPROVAL", "Waiting for a fresh approval");
      return;
    }
    // Unknown: keep the reservation, keep the account blocked, never resend.
    await db`update exchange_orders set state = 'unknown', reject_message = ${res.reason} where id = ${orderId}`;
    await db`update exchange_accounts set blocked_reason = 'EXECUTION_UNKNOWN' where id = ${SANDBOX_ACCOUNT_ID} and blocked_by_order_id = ${orderId}`;
    await transition(db, o.run_id, "EXECUTION_UNKNOWN", "Execution status unknown; reconciling", { reason: res.reason });
    await appendEvent(db, o.run_id, {
      type: "order.unknown",
      provider: "gemini_markets",
      mode: "sandbox_exchange",
      title: "Execution status unknown. Funds stay reserved while we reconcile.",
      payload: { orderId, reason: res.reason },
    });
    await enqueue(db, "reconcile_order", o.run_id, { orderId }, { lane: ACCOUNT_LANE, maxAttempts: 30, runAfter: new Date(Date.now() + 3000) });
  };
}

export function reconcileOrderHandler(deps: ExecutionDeps) {
  return async (job: Job) => reconcileOrder(deps, String(job.payload.orderId));
}

// Authoritative state comes from the exchange's order history and positions, never from the
// submit response alone. A fully filled IOC can be CANCELED; filledQuantity decides.
export async function reconcileOrder(deps: ExecutionDeps, orderId: string): Promise<void> {
  const { db } = deps;
  const o = await loadOrder(db, orderId);
  if (!o || o.state === "reconciled" || o.state === "rejected") return;
  const plan = TradePlan.parse(o.body.plan);
  const client = await deps.trading();
  const submittedAtMs = o.submitted_at?.getTime() ?? Date.now();

  const history = await listOrderHistory(client, { symbol: o.symbol, fromMs: submittedAtMs - 60_000 });
  let found: ExchangeOrder | null = null;
  if (o.exchange_order_id) {
    found = history.find((h) => h.orderId === o.exchange_order_id) ?? null;
  } else {
    const r = findSubmittedOrder(history, { symbol: o.symbol, outcome: o.outcome, quantity: plan.quantity, limitPrice: plan.limitPrice, submittedAtMs, windowMs: 60_000 });
    if (r.ambiguous) {
      await appendEvent(db, o.run_id, { type: "order.unknown", provider: "gemini_markets", mode: "sandbox_exchange", title: "Two matching orders found; operator review needed", payload: { orderId } });
      return;
    }
    found = r.match;
  }

  if (!found) {
    // Still open, or not visible yet. FOK orders terminate immediately, so give the exchange
    // a bounded window before concluding nothing was created.
    if (Date.now() - submittedAtMs < 120_000) throw new Error("order not visible in history yet");
    await db`update exchange_orders set state = 'reconciled', filled_quantity = 0, reconciled_at = now(), reject_message = 'no matching order on the exchange after 120s' where id = ${orderId}`;
    await releaseReservation(db, o.approval_id);
    await unblockAccount(db, orderId);
    await transition(db, o.run_id, "RECONCILING", "Reconciling");
    await transition(db, o.run_id, "NO_FILL", "No order exists on the exchange; nothing was bought");
    await appendEvent(db, o.run_id, { type: "order.no_fill", provider: "gemini_markets", mode: "sandbox_exchange", title: "Nothing was bought", payload: { orderId, reason: "NOT_FOUND_AFTER_WINDOW" } });
    return;
  }

  const filled = dec(found.filledQuantity);
  const avg = found.avgExecutionPrice ? dec(found.avgExecutionPrice) : dec(plan.limitPrice);
  const ledger = found.orderId ? deps.ledgers.get(found.orderId)?.state() : undefined;
  const useStream = !!ledger && ledger.feesComplete && ledger.confirmedQuantity.eq(filled) && ledger.fills.length > 0;
  const principal = useStream ? ledger!.principal : filled.mul(avg);
  const fees = useStream ? ledger!.fees : filled.gt(0) ? fillFee(filled, avg, PUBLISHED_FEE_SCHEDULE) : ZERO;

  const positions = await listPositions(client).catch(() => []);
  const pos = positions.find((p) => p.symbol === o.symbol && p.outcome === o.outcome);

  const events = await db.begin(async (tx) => {
    await tx`
      update exchange_orders set state = 'reconciled', exchange_order_id = ${found!.orderId}, exchange_status = ${found!.status},
        filled_quantity = ${filled.toString()}, avg_price = ${avg.toString()}, principal_usd = ${principal.toFixed(4)},
        fees_usd = ${fees.toFixed(4)}, fees_source = ${useStream ? "stream" : "formula"}, reconciled_at = now()
      where id = ${orderId}`;
    if (useStream) {
      for (const f of ledger!.fills) {
        await tx`insert into fills (order_id, trade_id, quantity, price, fee_usd, maker, source)
          values (${orderId}, ${f.tradeId}, ${f.quantity.toString()}, ${f.price.toString()}, ${f.fee?.toString() ?? null}, ${f.maker}, 'stream')
          on conflict do nothing`;
      }
    }
    if (filled.lte(0)) {
      await tx`update budget_reservations set status = 'released', updated_at = now() where approval_id = ${o.approval_id}`;
      return null;
    }
    // Spend is checked against the reservation by a table constraint.
    await tx`update budget_reservations set spent_usd = ${principal.plus(fees).toDecimalPlaces(2, 0).toFixed(2)}, status = 'consumed', updated_at = now() where approval_id = ${o.approval_id}`;
    const [h] = await tx<{ id: string }[]>`
      insert into holdings (order_id, risk_id, symbol, outcome, confirmed_units)
      values (${orderId}, ${plan.riskId}, ${o.symbol}, ${o.outcome}, ${filled.toString()})
      on conflict (order_id) do update set confirmed_units = excluded.confirmed_units
      returning id`;
    await tx`update plans set status = 'executed' where id = ${o.plan_id}`;
    await tx`update risks set status = 'active' where id = ${plan.riskId}`;
    let campaign: { id: string; slug: string; public_token: string; max_entitlements: number } | null = null;
    if (plan.campaign) {
      // Capacity published = whole rewards the confirmed units can pay. Never the request.
      const capacity = filled.div(dec(plan.campaign.rewardPerEntitlementUsd)).floor().toNumber();
      const venue = o.body.presentation.venueName ?? "Test venue";
      const slug = `${venue.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24)}-${randomBytes(3).toString("hex")}`;
      const [c] = await tx<{ id: string; slug: string; public_token: string; max_entitlements: number }[]>`
        insert into campaigns (merchant_id, risk_id, plan_id, holding_id, slug, venue_name, headline, qualification, reward_usd, max_entitlements, status, closes_at)
        values (${o.merchant_id}, ${plan.riskId}, ${o.plan_id}, ${h!.id}, ${slug}, ${venue}, ${plan.campaign.headline}, ${plan.campaign.qualification},
          ${plan.campaign.rewardPerEntitlementUsd}, ${capacity}, 'active', ${plan.campaign.enrollmentClosesAt})
        returning id, slug, public_token, max_entitlements`;
      campaign = c!;
    }
    return { holdingId: h!.id, campaign };
  });

  await unblockAccount(db, orderId);
  const state = await db<{ state: RunState }[]>`select state from runs where id = ${o.run_id}`;
  if (state[0]?.state === "EXECUTION_UNKNOWN") await transition(db, o.run_id, "RECONCILING", "Reconciling");

  await appendEvent(db, o.run_id, {
    type: "order.reconciled",
    provider: "gemini_markets",
    mode: "sandbox_exchange",
    title: filled.gt(0) ? `Filled ${filled.toString()} ${o.outcome.toUpperCase()} at avg ${avg.toDecimalPlaces(4).toString()}` : "Order ended with no fill",
    payload: {
      orderId,
      exchangeOrderId: found.orderId,
      exchangeStatus: found.status,
      filledQuantity: filled.toString(),
      avgPrice: avg.toString(),
      principalUsd: usd(principal),
      feesUsd: usd(fees),
      feesSource: useStream ? "stream" : "formula",
      totalDebitUsd: usd(principal.plus(fees)),
      maxDebitUsd: plan.maxDebitUsd,
      position: pos ?? null,
    },
  });

  if (!events) {
    await transition(db, o.run_id, "NO_FILL", "Fill-or-kill order did not fill; nothing was bought");
    await appendEvent(db, o.run_id, { type: "order.no_fill", provider: "gemini_markets", mode: "sandbox_exchange", title: "Nothing was bought", payload: { orderId, exchangeStatus: found.status } });
    return;
  }
  await transition(db, o.run_id, "ACTIVE", "Hedge confirmed");
  if (events.campaign) {
    await appendEvent(db, o.run_id, {
      type: "capacity.changed",
      provider: "app",
      mode: "sandbox_exchange",
      title: `${events.campaign.max_entitlements} test rewards available`,
      payload: { campaignId: events.campaign.id, slug: events.campaign.slug, token: events.campaign.public_token, capacity: events.campaign.max_entitlements, remaining: events.campaign.max_entitlements },
    });
  }
}
