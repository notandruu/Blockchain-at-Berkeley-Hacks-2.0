import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, type Sql } from "./db.js";

// These run against the local Supabase Postgres with the committed migrations applied
// (`supabase start`). They attack the constraints directly, the way a service bug would.
const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
let db: Sql;
let reachable = true;

async function fixture(db: Sql, opts: { confirmedUnits: string; reward: string; maxEntitlements: number }) {
  const userId = randomUUID();
  await db`insert into auth.users (id, email, aud, role) values (${userId}, ${`t-${userId}@riskpilot.test`}, 'authenticated', 'authenticated')`;
  const [m] = await db<{ id: string }[]>`insert into merchants (name) values ('Invariant Test Bar') returning id`;
  const [run] = await db<{ id: string }[]>`insert into runs (merchant_id, created_by, goal, research_credit_ceiling) values (${m!.id}, ${userId}, 'test', 40) returning id`;
  const [risk] = await db<{ id: string }[]>`insert into risks (merchant_id, run_id, mode, title, spec) values (${m!.id}, ${run!.id}, 'promotion', 't', '{}') returning id`;
  const [q] = await db<{ id: string }[]>`insert into quotes (run_id, instrument_symbol, environment, outcome, depth, body, observed_at) values (${run!.id}, 'GEMI-T', 'sandbox', 'yes', '{}', '{}', now()) returning id`;
  const [plan] = await db<{ id: string }[]>`
    insert into plans (plan_group_id, version, run_id, risk_id, quote_id, body, plan_hash, max_debit_usd, expires_at)
    values (${randomUUID()}, 1, ${run!.id}, ${risk!.id}, ${q!.id}, '{}', 'h', 50, now() + interval '1 hour') returning id`;
  const [appr] = await db<{ id: string }[]>`
    insert into approvals (plan_id, merchant_id, user_id, plan_version, plan_hash, max_debit_usd, idempotency_key)
    values (${plan!.id}, ${m!.id}, ${userId}, 1, 'h', 50, ${randomUUID()}) returning id`;
  const [order] = await db<{ id: string }[]>`
    insert into exchange_orders (approval_id, plan_id, account_id, environment, symbol, outcome, quantity, limit_price, time_in_force, state, filled_quantity)
    values (${appr!.id}, ${plan!.id}, 'sandbox-primary', 'sandbox', 'GEMI-T', 'yes', ${opts.confirmedUnits}, 0.4, 'fill-or-kill', 'reconciled', ${opts.confirmedUnits}) returning id`;
  const [h] = await db<{ id: string }[]>`insert into holdings (order_id, risk_id, symbol, outcome, confirmed_units) values (${order!.id}, ${risk!.id}, 'GEMI-T', 'yes', ${opts.confirmedUnits}) returning id`;
  const [c] = await db<{ id: string; public_token: string }[]>`
    insert into campaigns (merchant_id, risk_id, plan_id, holding_id, slug, venue_name, headline, qualification, reward_usd, max_entitlements, status, closes_at)
    values (${m!.id}, ${risk!.id}, ${plan!.id}, ${h!.id}, ${`t-${randomUUID().slice(0, 8)}`}, 'Test', 'h', 'q', ${opts.reward}, ${opts.maxEntitlements}, 'active', now() + interval '1 hour')
    returning id, public_token`;
  return { campaignId: c!.id, token: c!.public_token, holdingId: h!.id, approvalId: appr!.id, planId: plan!.id, merchantId: m!.id, userId };
}

beforeAll(async () => {
  db = connect(url);
  try {
    await db`select 1 from claim_entitlement(gen_random_uuid(), 'x', 'x', 'x') limit 0`;
  } catch {
    reachable = false;
  }
});

afterAll(async () => {
  await db?.end({ timeout: 2 });
});

describe.skipIf(!process.env.DB_TESTS)("database invariants", () => {
  it("lets exactly one of many concurrent claims take the last slot", async () => {
    expect(reachable).toBe(true);
    const f = await fixture(db, { confirmedUnits: "60", reward: "20", maxEntitlements: 3 });
    // 3 slots, 12 customers tapping at once from separate connections.
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        db<{ result: string }[]>`select result from claim_entitlement(${f.campaignId}, ${f.token}, ${`p-${i}`}, ${randomUUID()})`.then((r) => r[0]!.result),
      ),
    );
    expect(results.filter((r) => r === "ok")).toHaveLength(3);
    expect(results.filter((r) => r === "CAPACITY_EXHAUSTED")).toHaveLength(9);
    const [h] = await db<{ allocated_units: string; confirmed_units: string }[]>`select allocated_units, confirmed_units from holdings where id = ${f.holdingId}`;
    expect(Number(h!.allocated_units)).toBe(60);
  });

  it("returns the same entitlement for a retried claim instead of a second one", async () => {
    const f = await fixture(db, { confirmedUnits: "100", reward: "20", maxEntitlements: 5 });
    const key = randomUUID();
    const a = await db<{ entitlement_id: string }[]>`select entitlement_id from claim_entitlement(${f.campaignId}, ${f.token}, 'same-phone', ${key})`;
    const b = await db<{ entitlement_id: string }[]>`select entitlement_id from claim_entitlement(${f.campaignId}, ${f.token}, 'same-phone', ${key})`;
    expect(b[0]!.entitlement_id).toBe(a[0]!.entitlement_id);
  });

  it("rejects a second claim from the same participant", async () => {
    const f = await fixture(db, { confirmedUnits: "100", reward: "20", maxEntitlements: 5 });
    await db`select claim_entitlement(${f.campaignId}, ${f.token}, 'phone-1', ${randomUUID()})`;
    const [r] = await db<{ result: string }[]>`select result from claim_entitlement(${f.campaignId}, ${f.token}, 'phone-1', ${randomUUID()})`;
    expect(r!.result).toBe("DUPLICATE_CLAIM");
  });

  it("refuses an allocation beyond confirmed holdings at the table level", async () => {
    const f = await fixture(db, { confirmedUnits: "40", reward: "20", maxEntitlements: 2 });
    await expect(db`update holdings set allocated_units = 41 where id = ${f.holdingId}`).rejects.toThrow(/holdings_no_oversubscription/);
  });

  it("refuses to cover one entitlement with two allocations", async () => {
    const f = await fixture(db, { confirmedUnits: "100", reward: "20", maxEntitlements: 5 });
    const [r] = await db<{ entitlement_id: string }[]>`select entitlement_id from claim_entitlement(${f.campaignId}, ${f.token}, 'p', ${randomUUID()})`;
    await expect(db`insert into position_allocations (holding_id, entitlement_id, units) values (${f.holdingId}, ${r!.entitlement_id}, 20)`).rejects.toThrow(/duplicate key/);
  });

  it("keeps spend within the reservation and the reservation within the approval", async () => {
    const f = await fixture(db, { confirmedUnits: "40", reward: "20", maxEntitlements: 2 });
    await expect(db`insert into budget_reservations (approval_id, merchant_id, reserved_usd) values (${f.approvalId}, ${f.merchantId}, 50.01)`).rejects.toThrow(/exceeds approved maximum/);
    await db`insert into budget_reservations (approval_id, merchant_id, reserved_usd) values (${f.approvalId}, ${f.merchantId}, 50)`;
    await expect(db`update budget_reservations set spent_usd = 50.01 where approval_id = ${f.approvalId}`).rejects.toThrow(/check constraint/);
  });

  it("refuses a second execution intent for the same approval", async () => {
    const f = await fixture(db, { confirmedUnits: "40", reward: "20", maxEntitlements: 2 });
    await expect(
      db`insert into exchange_orders (approval_id, plan_id, account_id, environment, symbol, outcome, quantity, limit_price, time_in_force)
         values (${f.approvalId}, ${f.planId}, 'sandbox-primary', 'sandbox', 'GEMI-T', 'yes', 40, 0.4, 'fill-or-kill')`,
    ).rejects.toThrow(/duplicate key/);
  });

  it("does not let a plan body change after it is saved", async () => {
    const f = await fixture(db, { confirmedUnits: "40", reward: "20", maxEntitlements: 2 });
    await expect(db`update plans set max_debit_usd = 49 where id = ${f.planId}`).rejects.toThrow(/immutable/);
    await db`update plans set status = 'superseded' where id = ${f.planId}`;
  });

  it("pausing keeps existing entitlements and allocated units", async () => {
    const f = await fixture(db, { confirmedUnits: "100", reward: "20", maxEntitlements: 5 });
    await db`select claim_entitlement(${f.campaignId}, ${f.token}, 'p1', ${randomUUID()})`;
    await db`select pause_campaign(${f.campaignId}, 'test')`;
    const [r] = await db<{ result: string }[]>`select result from claim_entitlement(${f.campaignId}, ${f.token}, 'p2', ${randomUUID()})`;
    expect(r!.result).toBe("CAMPAIGN_CLOSED");
    const [e] = await db<{ n: number }[]>`select count(*)::int as n from entitlements where campaign_id = ${f.campaignId} and status = 'active'`;
    const [h] = await db<{ allocated_units: string }[]>`select allocated_units from holdings where id = ${f.holdingId}`;
    expect(e!.n).toBe(1);
    expect(Number(h!.allocated_units)).toBe(20);
  });

  it("rejects observed evidence that has no source passage", async () => {
    const f = await fixture(db, { confirmedUnits: "40", reward: "20", maxEntitlements: 2 });
    const [run] = await db<{ run_id: string }[]>`select run_id from plans where id = ${f.planId}`;
    await expect(db`insert into evidence (run_id, provenance, claim) values (${run!.run_id}, 'source', 'made up')`).rejects.toThrow(/check constraint/);
  });
});
