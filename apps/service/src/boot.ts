import { createTradingClient, type GeminiClient } from "@beagle/provider-gemini";
import { supabaseAdmin } from "./auth.js";
import { geminiCredentials, loadConfig } from "./config.js";
import { connect } from "./db.js";
import { AccountStream } from "./execution/account-stream.js";
import { ACCOUNT_LANE } from "./execution/approve.js";
import { executeOrderHandler, reconcileOrderHandler } from "./execution/execute.js";
import { buildServer } from "./http/server.js";
import { enqueue, Worker } from "./jobs.js";
import { researchHandler } from "./research/pipeline.js";

// Everything the service needs, built once. The long-running server (main.ts) starts the
// worker loops; the serverless entry (vercel.ts) drains jobs after each request instead.
export async function boot() {
  const cfg = loadConfig();
  const db = connect(cfg.DATABASE_URL, cfg.DB_POOL_MAX);
  const admin = supabaseAdmin(cfg.SUPABASE_URL, cfg.SUPABASE_SECRET_KEY);

  let tradingClient: Promise<GeminiClient> | null = null;
  const trading = cfg.providers.gemini ? () => (tradingClient ??= createTradingClient(cfg.GEMINI_ENV, geminiCredentials(cfg))) : null;
  const accountStream = trading ? new AccountStream(trading, cfg.GEMINI_API_KEY.startsWith("master-")) : null;

  const worker = new Worker(db, cfg.WORKER_ID, [
    { name: "research", concurrency: 3, retryable: false, leaseMs: 5 * 60_000, minBudgetMs: cfg.RUN_DEADLINE_MS + 10_000 },
    // One mutation lane for the sandbox account. Reconcile jobs retry; submits never do.
    { name: ACCOUNT_LANE, concurrency: 1, retryable: true, leaseMs: 60_000, minBudgetMs: 30_000 },
  ]);
  worker.on("research", researchHandler(db, admin, cfg));
  if (trading && accountStream) {
    const execDeps = { db, trading, ledgers: accountStream.ledgers, quoteMaxAgeMs: cfg.QUOTE_MAX_AGE_MS };
    worker.on("execute_order", executeOrderHandler(execDeps));
    worker.on("reconcile_order", reconcileOrderHandler(execDeps));
  }

  // Recovery before new financial actions: any order left mid-flight by a crash is
  // reconciled from the exchange first. The account lane runs jobs in order, so these go
  // before any execute_order queued later. Skipped when a reconcile is already queued.
  async function recover(): Promise<void> {
    const stuck = await db<{ id: string; run_id: string }[]>`
      select o.id, p.run_id from exchange_orders o join plans p on p.id = o.plan_id
      where o.state in ('submitting', 'accepted', 'unknown')
        and not exists (select 1 from jobs j where j.kind = 'reconcile_order' and j.status in ('queued', 'leased') and j.payload->>'orderId' = o.id::text)`;
    for (const o of stuck) await enqueue(db, "reconcile_order", o.run_id, { orderId: o.id }, { lane: ACCOUNT_LANE, maxAttempts: 30 });
  }

  const app = await buildServer({ db, admin, cfg, trading, accountStream });
  return { cfg, db, app, worker, accountStream, recover };
}
