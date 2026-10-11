import { DomainError, planHash, TradePlan, type RunState } from "@riskpilot/domain";
import type { Principal } from "../auth.js";
import type { Sql } from "../db.js";
import { appendEventTx, publish } from "../events.js";
import { enqueue } from "../jobs.js";

export const SANDBOX_ACCOUNT_ID = "sandbox-primary";
export const ACCOUNT_LANE = `account:${SANDBOX_ACCOUNT_ID}`;

interface PlanRow {
  id: string;
  run_id: string;
  version: number;
  plan_group_id: string;
  body: { plan: TradePlan };
  plan_hash: string;
  max_debit_usd: string;
  status: string;
  expires_at: Date;
  last_quote_check: { fillable: boolean; observedAt: string } | null;
  merchant_id: string;
}

// Approve exactly the version the merchant saw. The browser sends only the plan id, the
// version and hash it displayed, and an idempotency key. Order details always come from the
// stored plan.
export async function approvePlan(
  db: Sql,
  p: Principal,
  planId: string,
  shown: { version: number; planHash: string },
  idempotencyKey: string,
  quoteMaxAgeMs: number,
): Promise<{ approvalId: string; orderId: string; replayed: boolean }> {
  const result = await db.begin(async (tx) => {
    const prior = await tx<{ id: string; order_id: string }[]>`
      select a.id, o.id as order_id from approvals a join exchange_orders o on o.approval_id = a.id where a.idempotency_key = ${idempotencyKey}`;
    if (prior[0]) return { approvalId: prior[0].id, orderId: prior[0].order_id, replayed: true, events: [] };

    const [plan] = await tx<PlanRow[]>`
      select p.*, r.merchant_id from plans p join runs r on r.id = p.run_id where p.id = ${planId} for update of p`;
    if (!plan) throw new DomainError("NOT_FOUND", "plan not found");
    if (!p.merchantIds.includes(plan.merchant_id)) throw new DomainError("FORBIDDEN", "not a member of this merchant");

    // The repeated-click case lands here too: one approval per plan, enforced by a unique key.
    const existing = await tx<{ id: string }[]>`select id from approvals where plan_id = ${planId}`;
    if (existing[0]) throw new DomainError("IDEMPOTENCY_CONFLICT", "this plan version was already approved");

    if (plan.status === "superseded") throw new DomainError("PLAN_SUPERSEDED", "a newer version of this plan exists");
    if (plan.status !== "proposed") throw new DomainError("PLAN_SUPERSEDED", `plan is ${plan.status}`);
    if (plan.expires_at.getTime() <= Date.now()) throw new DomainError("PLAN_EXPIRED", "plan expired; refresh the quote");

    // Integrity: the stored hash must still describe the stored body, and the merchant must
    // have been looking at this exact version.
    const recomputed = planHash(TradePlan.parse(plan.body.plan));
    if (recomputed !== plan.plan_hash) throw new DomainError("RULES_CHANGED", "stored plan failed its integrity check");
    if (shown.version !== plan.version || shown.planHash !== plan.plan_hash) {
      throw new DomainError("PLAN_SUPERSEDED", "the plan changed since it was displayed");
    }

    const check = plan.last_quote_check;
    if (!check || !check.fillable || Date.now() - Date.parse(check.observedAt) > quoteMaxAgeMs) {
      throw new DomainError("QUOTE_STALE", "the live book has not been checked recently enough to buy");
    }

    const [acct] = await tx<{ blocked_by_order_id: string | null; blocked_reason: string | null }[]>`
      select blocked_by_order_id, blocked_reason from exchange_accounts where id = ${SANDBOX_ACCOUNT_ID} for update`;
    if (!acct) throw new DomainError("PROVIDER_UNAVAILABLE", "sandbox account is not registered");
    if (acct.blocked_by_order_id) {
      throw new DomainError(acct.blocked_reason === "EXECUTION_UNKNOWN" ? "EXECUTION_UNKNOWN" : "ACCOUNT_BUSY", "another order on this account is not reconciled yet");
    }

    const [run] = await tx<{ state: RunState }[]>`select state from runs where id = ${plan.run_id} for update`;
    if (run?.state !== "AWAITING_APPROVAL") throw new DomainError("PLAN_SUPERSEDED", `run is ${run?.state}`);

    const [approval] = await tx<{ id: string }[]>`
      insert into approvals (plan_id, merchant_id, user_id, plan_version, plan_hash, max_debit_usd, scope, idempotency_key)
      values (${plan.id}, ${plan.merchant_id}, ${p.userId}, ${plan.version}, ${plan.plan_hash}, ${plan.max_debit_usd}, 'single_purchase', ${idempotencyKey})
      returning id`;
    await tx`insert into budget_reservations (approval_id, merchant_id, reserved_usd) values (${approval!.id}, ${plan.merchant_id}, ${plan.max_debit_usd})`;
    await tx`update plans set status = 'approved' where id = ${plan.id}`;
    const tp = plan.body.plan;
    const [order] = await tx<{ id: string }[]>`
      insert into exchange_orders (approval_id, plan_id, account_id, environment, symbol, outcome, quantity, limit_price, time_in_force)
      values (${approval!.id}, ${plan.id}, ${SANDBOX_ACCOUNT_ID}, 'sandbox', ${tp.instrumentSymbol}, ${tp.outcome}, ${tp.quantity}, ${tp.limitPrice}, ${tp.timeInForce})
      returning id`;
    await tx`update runs set state = 'APPROVED', updated_at = now() where id = ${plan.run_id}`;
    const events = [
      await appendEventTx(tx, plan.run_id, {
        type: "approval.recorded",
        provider: "app",
        mode: "sandbox_exchange",
        title: `Approved v${plan.version}: up to $${plan.max_debit_usd}`,
        payload: { approvalId: approval!.id, planId: plan.id, version: plan.version, planHash: plan.plan_hash, maxDebitUsd: plan.max_debit_usd, reservedUsd: plan.max_debit_usd, userId: p.userId },
      }),
      await appendEventTx(tx, plan.run_id, {
        type: "run.state_changed",
        provider: "app",
        mode: "sandbox_exchange",
        title: "Funds reserved",
        payload: { from: "AWAITING_APPROVAL", to: "APPROVED" },
      }),
    ];
    return { approvalId: approval!.id, orderId: order!.id, replayed: false, events, runId: plan.run_id };
  });
  publish(...result.events);
  if (!result.replayed) {
    await enqueue(db, "execute_order", (result as { runId: string }).runId, { orderId: result.orderId }, { lane: ACCOUNT_LANE, maxAttempts: 1 });
  }
  return { approvalId: result.approvalId, orderId: result.orderId, replayed: result.replayed };
}
