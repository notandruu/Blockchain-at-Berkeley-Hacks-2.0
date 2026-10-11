import { DomainError } from "@beagle/domain";
import { promotionScenarios } from "@beagle/risk-engine";
import type { Sql } from "./db.js";
import { appendEvent } from "./events.js";

export interface PublicCampaign {
  slug: string;
  venueName: string;
  headline: string;
  qualification: string;
  rewardUsd: string;
  capacity: number;
  remaining: number;
  status: string;
  closesAt: string;
  eventTitle: string | null;
  settlesAt: string | null;
}

// What an anonymous phone can see. No merchant financial tables, no token, no order data.
export async function publicCampaign(db: Sql, slug: string): Promise<PublicCampaign | null> {
  const [c] = await db<{ slug: string; venue_name: string; headline: string; qualification: string; reward_usd: string; max_entitlements: number; status: string; closes_at: Date; confirmed: string | null; allocated: string | null; held: string | null; presentation: { eventTitle?: string; expiryDate?: string } | null }[]>`
    select c.slug, c.venue_name, c.headline, c.qualification, c.reward_usd, c.max_entitlements, c.status, c.closes_at,
      h.confirmed_units as confirmed, h.allocated_units as allocated, h.held_units as held, p.body->'presentation' as presentation
    from campaigns c left join holdings h on h.id = c.holding_id join plans p on p.id = c.plan_id
    where c.slug = ${slug}`;
  if (!c) return null;
  const free = c.confirmed ? Number(c.confirmed) - Number(c.allocated) - Number(c.held) : 0;
  return {
    slug: c.slug,
    venueName: c.venue_name,
    headline: c.headline,
    qualification: c.qualification,
    rewardUsd: c.reward_usd,
    capacity: c.max_entitlements,
    remaining: Math.max(0, Math.floor(free / Number(c.reward_usd))),
    status: c.status,
    closesAt: c.closes_at.toISOString(),
    eventTitle: c.presentation?.eventTitle ?? null,
    settlesAt: c.presentation?.expiryDate ?? null,
  };
}

export async function claim(db: Sql, slug: string, token: string, participant: string, idempotencyKey: string) {
  const [c] = await db<{ id: string; risk_run: string }[]>`
    select c.id, k.run_id as risk_run from campaigns c join risks k on k.id = c.risk_id where c.slug = ${slug}`;
  if (!c) throw new DomainError("NOT_FOUND", "campaign not found");
  const [r] = await db<{ result: string; entitlement_id: string | null; voucher_code: string | null; remaining: number }[]>`
    select * from claim_entitlement(${c.id}, ${token}, ${participant}, ${idempotencyKey})`;
  if (!r) throw new DomainError("PROVIDER_UNAVAILABLE", "claim failed");
  if (r.result !== "ok") throw new DomainError(r.result as never, r.result.replaceAll("_", " ").toLowerCase());
  await appendEvent(db, c.risk_run, {
    type: "capacity.changed",
    provider: "app",
    mode: "sandbox_exchange",
    title: r.remaining === 0 ? "Capacity reached. New claims are closed." : `Test reward claimed. ${r.remaining} left.`,
    payload: { campaignId: c.id, entitlementId: r.entitlement_id, remaining: r.remaining },
  });
  return { entitlementId: r.entitlement_id!, voucherCode: r.voucher_code!, remaining: r.remaining };
}

export async function pause(db: Sql, campaignId: string, reason: string): Promise<void> {
  await db`select pause_campaign(${campaignId}, ${reason})`;
  const [c] = await db<{ run_id: string }[]>`select k.run_id from campaigns c join risks k on k.id = c.risk_id where c.id = ${campaignId}`;
  if (c) {
    await appendEvent(db, c.run_id, {
      type: "campaign.paused",
      provider: "app",
      mode: "sandbox_exchange",
      title: "New enrollment paused. Existing rewards and the hedge are unchanged.",
      payload: { campaignId, reason },
    });
  }
}

// Simulation only: reads the saved plan and real counts, writes to the simulations table and
// a 'simulation' mode event. It cannot reach orders, holdings or entitlements.
export async function simulate(db: Sql, runId: string, scenario: "win" | "lose" | "mismatch") {
  const [row] = await db<{ plan_id: string; body: { plan: { quantity: string; campaign: { rewardPerEntitlementUsd: string } | null } }; spent: string | null; claimed: string; capacity: number | null }[]>`
    select p.id as plan_id, p.body, r.spent_usd as spent,
      (select count(*) from entitlements e join campaigns c on c.id = e.campaign_id where c.plan_id = p.id and e.status = 'active')::text as claimed,
      (select max_entitlements from campaigns c where c.plan_id = p.id) as capacity
    from plans p
    left join approvals a on a.plan_id = p.id
    left join budget_reservations r on r.approval_id = a.id
    where p.run_id = ${runId} and p.status = 'executed'
    order by p.version desc limit 1`;
  if (!row) throw new DomainError("NOT_FOUND", "no executed plan to simulate");
  const reward = row.body.plan.campaign?.rewardPerEntitlementUsd ?? "0";
  const rows = promotionScenarios({ heldPayoutUnits: row.body.plan.quantity, costUsd: row.spent ?? "0", rewardUsd: reward, claimedEntitlements: Number(row.claimed), maxEntitlements: row.capacity ?? 0 });
  const lose = rows.find((r) => r.id === "lose")!;
  const owed = (Number(reward) * Number(row.claimed)).toFixed(2);
  const pick =
    scenario === "win"
      ? rows.find((r) => r.id === "win_partial")!
      : scenario === "lose"
        ? lose
        : {
            ...lose,
            id: "mismatch",
            label: "Customers think the promise was met but the contract settles NO",
            obligationUsd: owed,
            netCostUsd: (Number(owed) + Number(lose.costUsd)).toFixed(2),
            note: "Rewards owed with no payout. This is why the customer promise is worded from the contract's own terms.",
          };
  await db`insert into simulations (run_id, plan_id, scenario, inputs, result) values (${runId}, ${row.plan_id}, ${scenario}, ${db.json({ claimed: row.claimed } as never)}, ${db.json(pick as never)})`;
  await appendEvent(db, runId, { type: "simulation.result", provider: "risk_engine", mode: "simulation", title: `Simulation: ${pick.label}`, payload: { scenario, row: pick } });
  return pick;
}
