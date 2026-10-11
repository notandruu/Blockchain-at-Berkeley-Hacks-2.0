import { supabaseAdmin } from "../auth.js";
import { loadConfig } from "../config.js";
import { connect } from "../db.js";
import { appendEvent } from "../events.js";
import { planFromProposal } from "../research/planner.js";
import { ResearchToolkit } from "../research/toolkit.js";
import { transition } from "../runs.js";

// Operator path: plan from an explicit trigger without the research agent. Uses the same
// inventory discovery, matcher, live depth and quote engine as an agent run. The run says
// in its own event log that no web research was done.
//
//   pnpm --filter @beagle/service operator-plan -- --asset BTC --reward 20 --entitlements 10 --budget 350 --ceiling 0.65

const cfg = loadConfig();
const db = connect(cfg.DATABASE_URL);
const admin = supabaseAdmin(cfg.SUPABASE_URL, cfg.SUPABASE_SECRET_KEY);
const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : d;
};
const asset = arg("asset", "BTC");
const reward = arg("reward", "20");
const entitlements = Number(arg("entitlements", "10"));
const budget = arg("budget", "350");
const ceiling = arg("ceiling", "0.65");
const minMinutes = Number(arg("min-minutes", "15"));

const [m] = await db<{ id: string; user_id: string }[]>`select merchant_id as id, user_id from memberships where role = 'owner' limit 1`;
if (!m) throw new Error("run the seed script first");

const goal = `Operator plan: ${asset} promotion, $${reward} per customer, up to ${entitlements} customers, $${budget} max spend.`;
const [run] = await db<{ id: string }[]>`
  insert into runs (merchant_id, created_by, goal, inputs, research_credit_ceiling)
  values (${m.id}, ${m.user_id}, ${goal}, ${db.json({ budgetUsd: budget } as never)}, 0) returning id`;
const runId = run!.id;
await appendEvent(db, runId, { type: "run.accepted", provider: "app", mode: "live_research", title: "Operator plan started", payload: { goal } });
await transition(db, runId, "RESEARCHING", "Operator-specified trigger");
await appendEvent(db, runId, { type: "agent.note", provider: "app", mode: "live_research", title: "Operator-specified trigger. No web research was done for this run.", payload: {} });

const kit = new ResearchToolkit(db, admin, runId, null);
await kit.listMarketCandidates(["Crypto", "Sports"], null, `Reading Gemini inventory for ${asset}`);

// Soonest event for the asset that settles far enough out to run a campaign, and has depth.
const now = Date.now();
const events = [...new Map([...kit.candidates.values()]
  .filter((c) => c.environment === "sandbox" && c.eventTicker.startsWith(asset) && !/\d{2}M\d/.test(c.eventTicker) && c.expiryDate && Date.parse(c.expiryDate) > now + minMinutes * 60_000)
  .map((c) => [c.eventTicker, c])).values()].sort((a, b) => Date.parse(a.expiryDate!) - Date.parse(b.expiryDate!));
let chosen = null as (typeof events)[number] | null;
for (const e of events) {
  const rows = await kit.depthSummary(kit.eventCandidates(e.eventTicker, "sandbox").map((c) => c.instrumentSymbol), `Reading the live order book for ${e.eventTitle}`);
  if (rows.some((r) => r.yesAskSize > 0)) {
    chosen = e;
    break;
  }
}
if (!chosen) throw new Error(`no ${asset} event with sandbox depth right now`);
const strike = kit.eventCandidates(chosen.eventTicker, "sandbox").find((c) => c.strike?.type === "above")!;

await transition(db, runId, "MATCHING", "Matching contracts field by field");
const sf = [...kit.candidates.values()].find((c) => c.environment === "production" && c.eventTicker.startsWith("NFL") && /San Francisco/.test(c.eventTitle));
const r = await planFromProposal(
  db,
  kit,
  m.id,
  {
    mode: "promotion",
    title: `${asset} night promotion`,
    trigger: { kind: "price_threshold", asset, operator: "gte", threshold: strike.strike!.value!, thresholdUpper: null, observationTime: chosen.expiryDate!, settlementIndex: null },
    alternatives: sf
      ? [{ trigger: { kind: "sports_result", league: "Pro Football", homeTeam: "San Francisco", awayTeam: sf.participants.find((p) => !/San Francisco/.test(p.name))?.name.split(" ")[0] ?? "Seattle", team: "San Francisco", gameDate: (sf.startTime ?? chosen.expiryDate!).slice(0, 10), scheduledStart: sf.startTime, period: "final", tieTreatment: "no_reward", cancellationTreatment: "void_promotion" }, eventTicker: sf.eventTicker }]
      : [],
    eventTicker: chosen.eventTicker,
    budgetUsd: budget,
    priceCeiling: ceiling,
    exposureBasis: `Each qualifying customer is owed $${reward} if the contract settles YES.`,
    promotion: { rewardUsd: reward, maxEntitlements: entitlements, venueName: "Golden Bear Taproom", qualification: "Open a tab of $25 or more", enrollmentClosesAt: new Date(Date.parse(chosen.expiryDate!) - 5 * 60_000).toISOString() },
    operational: null,
    evidenceIds: [],
    considerSiblingStrikes: true,
  },
  { quoteMaxAgeMs: cfg.QUOTE_MAX_AGE_MS, feeBoundFillUnit: cfg.FEE_BOUND_FILL_UNIT, planTtlMs: 30 * 60_000 },
);
console.log(JSON.stringify({ runId, ...r, event: chosen.eventTicker }));
await db.end();
process.exit(0);
