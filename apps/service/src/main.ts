import { createTradingClient, type GeminiClient } from "@beagle/provider-gemini";
import { supabaseAdmin } from "./auth.js";
import { loadConfig } from "./config.js";
import { connect } from "./db.js";
import { AccountStream } from "./execution/account-stream.js";
import { ACCOUNT_LANE } from "./execution/approve.js";
import { executeOrderHandler, reconcileOrderHandler } from "./execution/execute.js";
import { buildServer } from "./http/server.js";
import { enqueue, Worker } from "./jobs.js";
import { researchHandler } from "./research/pipeline.js";

const cfg = loadConfig();
const db = connect(cfg.DATABASE_URL);
const admin = supabaseAdmin(cfg.SUPABASE_URL, cfg.SUPABASE_SECRET_KEY);

let tradingClient: Promise<GeminiClient> | null = null;
const trading = cfg.providers.gemini
  ? () => (tradingClient ??= createTradingClient(cfg.GEMINI_ENV, { apiKey: cfg.GEMINI_API_KEY, apiSecret: cfg.GEMINI_API_SECRET }))
  : null;
const accountStream = trading ? new AccountStream(trading) : null;

// Recovery before new financial actions: any order left mid-flight by a crash is reconciled
// from the exchange first. The account lane processes jobs in order, so these run before any
// new execute_order job queued after startup.
async function recover(): Promise<void> {
  const stuck = await db<{ id: string; run_id: string }[]>`
    select o.id, p.run_id from exchange_orders o join plans p on p.id = o.plan_id
    where o.state in ('submitting', 'accepted', 'unknown')`;
  for (const o of stuck) await enqueue(db, "reconcile_order", o.run_id, { orderId: o.id }, { lane: ACCOUNT_LANE, maxAttempts: 30 });
  // Research jobs whose worker died are picked up again by lease expiry; nothing to do here.
}

async function main(): Promise<void> {
  if (accountStream) await accountStream.start();
  await recover();

  const worker = new Worker(db, cfg.WORKER_ID, [
    { name: "research", concurrency: 3, retryable: false, leaseMs: 5 * 60_000 },
    // One mutation lane for the sandbox account. Reconcile jobs retry; submits never do.
    { name: ACCOUNT_LANE, concurrency: 1, retryable: true, leaseMs: 60_000 },
  ]);
  worker.on("research", researchHandler(db, admin, cfg));
  if (trading && accountStream) {
    const execDeps = { db, trading, ledgers: accountStream.ledgers, quoteMaxAgeMs: cfg.QUOTE_MAX_AGE_MS };
    worker.on("execute_order", executeOrderHandler(execDeps));
    worker.on("reconcile_order", reconcileOrderHandler(execDeps));
  }
  worker.start();

  const app = await buildServer({ db, admin, cfg, trading, accountStream });
  await app.listen({ port: cfg.SERVICE_PORT, host: "0.0.0.0" });
  app.log.info({ providers: cfg.providers, environment: "sandbox" }, "beagle service up");

  const shutdown = async () => {
    worker.stop();
    await app.close();
    await db.end({ timeout: 5 });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
