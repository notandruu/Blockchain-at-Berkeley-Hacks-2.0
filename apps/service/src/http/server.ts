import cors from "@fastify/cors";
import type { SupabaseClient } from "@supabase/supabase-js";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import { DomainError, type RunEvent } from "@riskpilot/domain";
import { assertPublicUrl, verifyContextWebhook } from "@riskpilot/provider-context";
import { getTermsStatus, getUsdBalance, listPositions, acceptTermsOnOwnerConsent, getTermsDocument, type GeminiClient } from "@riskpilot/provider-gemini";
import { authenticate, authorizeRun, requireMember, type Principal } from "../auth.js";
import { claim, pause, publicCampaign, simulate } from "../campaigns.js";
import type { Config } from "../config.js";
import type { Sql } from "../db.js";
import { appendEvent, eventsAfter, hub } from "../events.js";
import type { AccountStream } from "../execution/account-stream.js";
import { approvePlan } from "../execution/approve.js";
import { refreshPlanCheck } from "../execution/quote-check.js";
import { enqueue } from "../jobs.js";
import { signedArtifactUrl } from "../storage.js";
import { sendError } from "./errors.js";
import { runView } from "./views.js";

export interface ServerDeps {
  db: Sql;
  admin: SupabaseClient;
  cfg: Config;
  trading: (() => Promise<GeminiClient>) | null;
  accountStream: AccountStream | null;
}

declare module "fastify" {
  interface FastifyRequest {
    principal?: Principal;
    rawBody?: Buffer;
  }
}

const CreateRun = z.object({
  goal: z.string().min(8).max(2000),
  businessUrl: z.string().url().nullable().optional(),
  budgetUsd: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  merchantId: z.string().uuid().optional(),
});

// Tiny fixed-window limiter for the anonymous claim endpoint.
const hits = new Map<string, { n: number; reset: number }>();
function rateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return;
  }
  if (++h.n > max) throw new DomainError("RATE_LIMITED", "too many requests");
}

export async function buildServer(deps: ServerDeps) {
  const { db, admin, cfg } = deps;
  const app = Fastify({ logger: { level: "info" }, bodyLimit: 256 * 1024 });
  await app.register(cors, { origin: [cfg.WEB_ORIGIN], credentials: false, allowedHeaders: ["authorization", "content-type", "idempotency-key"] });

  // Keep the raw body for the webhook signature; parse JSON ourselves.
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    req.rawBody = body as Buffer;
    if (!(body as Buffer).length) return done(null, {});
    try {
      done(null, JSON.parse((body as Buffer).toString("utf8")));
    } catch (e) {
      done(e as Error, undefined);
    }
  });

  const auth = async (req: FastifyRequest) => {
    req.principal = await authenticate(admin, db, req.headers.authorization);
    return req.principal;
  };
  const wrap =
    <T>(fn: (req: FastifyRequest, reply: FastifyReply) => Promise<T>) =>
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        return await fn(req, reply);
      } catch (e) {
        return sendError(reply, e);
      }
    };

  app.get("/health", async () => ({
    ok: true,
    environment: "sandbox",
    providers: cfg.providers,
    accountStream: deps.accountStream?.status ?? null,
    model: cfg.AGENT_MODEL || null,
  }));

  // ---- runs -------------------------------------------------------------------------------
  app.post("/api/runs", wrap(async (req, reply) => {
    const p = await auth(req);
    const body = CreateRun.parse(req.body);
    const merchantId = body.merchantId ?? p.merchantIds[0];
    if (!merchantId) throw new DomainError("FORBIDDEN", "no merchant membership");
    requireMember(p, merchantId);
    if (body.businessUrl) await assertPublicUrl(body.businessUrl);
    const idem = (req.headers["idempotency-key"] as string | undefined) ?? null;
    if (idem) {
      const [prior] = await db<{ id: string; state: string }[]>`select id, state from runs where idempotency_key = ${idem}`;
      if (prior) return reply.status(202).send({ runId: prior.id, state: prior.state, replayed: true });
    }
    const [run] = await db<{ id: string }[]>`
      insert into runs (merchant_id, created_by, goal, business_url, inputs, research_credit_ceiling, idempotency_key)
      values (${merchantId}, ${p.userId}, ${body.goal}, ${body.businessUrl ?? null},
        ${db.json({ budgetUsd: body.budgetUsd ?? null, location: body.location ?? null, answers: {} } as never)},
        ${cfg.RESEARCH_CREDIT_CEILING}, ${idem})
      returning id`;
    await appendEvent(db, run!.id, { type: "run.accepted", provider: "app", mode: "live_research", title: "Research started", payload: { goal: body.goal, businessUrl: body.businessUrl ?? null, budgetUsd: body.budgetUsd ?? null } });
    await enqueue(db, "research", run!.id, {}, { lane: "research", maxAttempts: 1 });
    return reply.status(202).send({ runId: run!.id, state: "DRAFT" });
  }));

  app.post("/api/runs/:id/inputs", wrap(async (req, reply) => {
    const p = await auth(req);
    const { id } = req.params as { id: string };
    await authorizeRun(db, p, id);
    const { answers } = z.object({ answers: z.record(z.string(), z.string().max(500)) }).parse(req.body);
    await db`update runs set inputs = jsonb_set(inputs, '{answers}', coalesce(inputs->'answers', '{}'::jsonb) || ${db.json(answers as never)}) where id = ${id}`;
    if (answers.budgetUsd) await db`update runs set inputs = jsonb_set(inputs, '{budgetUsd}', to_jsonb(${answers.budgetUsd}::text)) where id = ${id}`;
    await appendEvent(db, id, { type: "evidence.added", provider: "app", mode: "live_research", title: "Merchant supplied details", payload: { provenance: "merchant", answers } });
    await enqueue(db, "research", id, {}, { lane: "research", maxAttempts: 1 });
    return reply.status(202).send({ ok: true });
  }));

  app.get("/api/runs", wrap(async (req) => {
    const p = await auth(req);
    return db`
      select r.id, r.goal, r.state, r.created_at, r.business_url,
        (select title from risks k where k.run_id = r.id order by created_at desc limit 1) as risk_title
      from runs r where r.merchant_id = any(${p.merchantIds}) order by r.created_at desc limit 20`;
  }));

  app.get("/api/runs/:id", wrap(async (req) => {
    const p = await auth(req);
    const { id } = req.params as { id: string };
    await authorizeRun(db, p, id);
    return runView(db, admin, id);
  }));

  // Replay then stream. Reconnects send ?after=<last sequence> and never re-run tools.
  app.get("/api/runs/:id/events", async (req, reply) => {
    try {
      const p = await auth(req);
      const { id } = req.params as { id: string };
      await authorizeRun(db, p, id);
      const after = Number((req.query as { after?: string }).after ?? -1);
      reply.hijack();
      const res = reply.raw;
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "access-control-allow-origin": cfg.WEB_ORIGIN,
      });
      let last = after;
      const send = (ev: RunEvent) => {
        if (ev.sequence <= last) return;
        last = ev.sequence;
        res.write(`id: ${ev.sequence}\nevent: run\ndata: ${JSON.stringify(ev)}\n\n`);
      };
      const listener = (ev: RunEvent) => send(ev);
      hub.on(`run:${id}`, listener);
      for (const ev of await eventsAfter(db, id, after)) send(ev);
      const beat = setInterval(() => res.write(`: heartbeat ${Date.now()}\n\n`), 15_000);
      req.raw.on("close", () => {
        clearInterval(beat);
        hub.off(`run:${id}`, listener);
      });
    } catch (e) {
      if (!reply.sent) return sendError(reply, e);
    }
  });

  app.get("/api/artifacts/:id", wrap(async (req, reply) => {
    const p = await auth(req);
    const { id } = req.params as { id: string };
    const [a] = await db<{ run_id: string }[]>`select run_id from artifacts where id = ${id}`;
    if (!a) throw new DomainError("NOT_FOUND", "artifact not found");
    await authorizeRun(db, p, a.run_id);
    const url = await signedArtifactUrl(admin, db, id);
    if (!url) throw new DomainError("NOT_FOUND", "artifact missing");
    return reply.send({ url, expiresInSeconds: 300 });
  }));

  // ---- plans and approval ----------------------------------------------------------------
  const planRun = async (p: Principal, planId: string) => {
    const [row] = await db<{ run_id: string }[]>`select run_id from plans where id = ${planId}`;
    if (!row) throw new DomainError("NOT_FOUND", "plan not found");
    await authorizeRun(db, p, row.run_id);
    return row.run_id;
  };

  app.post("/api/plans/:id/check", wrap(async (req) => {
    const p = await auth(req);
    const { id } = req.params as { id: string };
    await planRun(p, id);
    const check = await refreshPlanCheck(db, id);
    const stale = deps.accountStream?.status.stale ?? true;
    return { ...check, accountStreamStale: stale, quoteMaxAgeMs: cfg.QUOTE_MAX_AGE_MS };
  }));

  app.post("/api/plans/:id/approve", wrap(async (req, reply) => {
    const p = await auth(req);
    const { id } = req.params as { id: string };
    await planRun(p, id);
    if (!deps.trading) throw new DomainError("PROVIDER_UNAVAILABLE", "Gemini sandbox credentials are not configured");
    const body = z.object({ version: z.number().int().positive(), planHash: z.string().length(64) }).parse(req.body);
    const idem = z.string().min(8).max(200).parse(req.headers["idempotency-key"]);
    const r = await approvePlan(db, p, id, body, idem, cfg.QUOTE_MAX_AGE_MS);
    return reply.status(r.replayed ? 200 : 202).send(r);
  }));

  // ---- portfolio and risks ---------------------------------------------------------------
  app.get("/api/portfolio", wrap(async (req) => {
    const p = await auth(req);
    const holdings = await db`
      select h.id, h.symbol, h.outcome, h.confirmed_units, h.allocated_units, h.held_units, h.lifecycle,
        o.principal_usd, o.fees_usd, o.fees_source, o.avg_price, o.exchange_order_id, o.reconciled_at, k.title as risk_title, k.run_id
      from holdings h join exchange_orders o on o.id = h.order_id join risks k on k.id = h.risk_id
      where k.merchant_id = any(${p.merchantIds}) order by o.reconciled_at desc`;
    const pending = await db`
      select o.id, o.state, o.symbol, o.quantity, o.limit_price, r.reserved_usd, p.run_id
      from exchange_orders o join plans p on p.id = o.plan_id join runs ru on ru.id = p.run_id
      left join budget_reservations r on r.approval_id = o.approval_id
      where ru.merchant_id = any(${p.merchantIds}) and o.state in ('pending', 'submitting', 'accepted', 'unknown')`;
    const proposals = await db`
      select pl.id, pl.version, pl.max_debit_usd, pl.status, pl.run_id, pl.body->'plan'->>'instrumentSymbol' as symbol
      from plans pl join runs ru on ru.id = pl.run_id where ru.merchant_id = any(${p.merchantIds}) and pl.status = 'proposed'`;
    let exchange: { positions: unknown[]; balance: unknown; reconciledAt: string } | null = null;
    if (deps.trading) {
      try {
        const c = await deps.trading();
        const [positions, balance] = await Promise.all([listPositions(c), getUsdBalance(c)]);
        exchange = { positions, balance, reconciledAt: new Date().toISOString() };
      } catch (e) {
        exchange = null;
        req.log.warn({ err: e }, "portfolio reconcile failed");
      }
    }
    return { holdings, pending, proposals, exchange };
  }));

  app.get("/api/risks", wrap(async (req) => {
    const p = await auth(req);
    return db`
      select k.id, k.title, k.mode, k.status, k.created_at, k.run_id, ru.state as run_state,
        (select match_type from contract_matches m where m.risk_id = k.id order by case match_type when 'exact' then 0 when 'proxy' then 1 else 2 end limit 1) as best_match
      from risks k join runs ru on ru.id = k.run_id where k.merchant_id = any(${p.merchantIds}) order by k.created_at desc`;
  }));

  // ---- campaigns -------------------------------------------------------------------------
  app.post("/api/campaigns/:id/pause", wrap(async (req) => {
    const p = await auth(req);
    const { id } = req.params as { id: string };
    const [c] = await db<{ merchant_id: string }[]>`select merchant_id from campaigns where id = ${id}`;
    if (!c) throw new DomainError("NOT_FOUND", "campaign not found");
    requireMember(p, c.merchant_id);
    await pause(db, id, z.object({ reason: z.string().max(200).default("Paused by merchant") }).parse(req.body ?? {}).reason);
    return { ok: true };
  }));

  app.get("/api/public/campaigns/:slug", wrap(async (req) => {
    const { slug } = req.params as { slug: string };
    const c = await publicCampaign(db, slug);
    if (!c) throw new DomainError("NOT_FOUND", "campaign not found");
    return c;
  }));

  app.post("/api/public/campaigns/:slug/claims", wrap(async (req, reply) => {
    const { slug } = req.params as { slug: string };
    rateLimit(`claim:${req.ip}`, 20, 60_000);
    const body = z.object({ token: z.string().min(8), participant: z.string().min(6).max(80), tabTotalUsd: z.string().regex(/^\d+(\.\d{1,2})?$/) }).parse(req.body);
    const idem = z.string().min(8).max(200).parse(req.headers["idempotency-key"]);
    // The qualification is checked before any capacity is touched.
    const c = await publicCampaign(db, slug);
    if (!c) throw new DomainError("NOT_FOUND", "campaign not found");
    const minimum = /\$(\d+(?:\.\d+)?)/.exec(c.qualification)?.[1];
    if (minimum && Number(body.tabTotalUsd) < Number(minimum)) throw new DomainError("VALIDATION_FAILED", `test tab must be at least $${minimum}`);
    const r = await claim(db, slug, body.token, body.participant, idem);
    return reply.status(201).send(r);
  }));

  // ---- webhooks --------------------------------------------------------------------------
  app.post("/api/webhooks/context", wrap(async (req, reply) => {
    const raw = req.rawBody ?? Buffer.alloc(0);
    const eventId = req.headers["x-context-id"] as string | undefined;
    const sigHeader = req.headers["x-context-signature"] as string | undefined;
    const monitorRows = await db<{ context_monitor_id: string; webhook_secret: string | null; campaign_id: string | null; run_id: string }[]>`select context_monitor_id, webhook_secret, campaign_id, run_id from monitors where status = 'active'`;
    const secrets = [cfg.CONTEXT_WEBHOOK_SECRET, ...monitorRows.map((m) => m.webhook_secret)].filter((s): s is string => !!s);
    const ok = secrets.some((s) => verifyContextWebhook(raw, sigHeader, s).ok);
    if (!ok || !eventId) return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "bad signature" } });
    const payload = JSON.parse(raw.toString("utf8")) as { type?: string; monitor_id?: string; data?: { monitor_id?: string } };
    const inserted = await db`
      insert into webhook_events (id, event_type, payload) values (${eventId}, ${payload.type ?? null}, ${db.json(payload as never)})
      on conflict (id) do nothing returning id`;
    if (!inserted.length) return reply.status(200).send({ duplicate: true });
    const monitorKey = payload.monitor_id ?? payload.data?.monitor_id;
    const m = monitorKey ? monitorRows.find((x) => x.context_monitor_id === monitorKey) : undefined;
    if (m) {
      // A verified change can pause new enrollment. It never touches the hedge or existing rewards.
      await appendEvent(db, m.run_id, { type: "monitor.change", provider: "context", mode: "live_research", title: "A watched page changed", payload: { eventId, type: payload.type } });
      if (m.campaign_id) await pause(db, m.campaign_id, "Watched source changed; review before reopening");
    }
    return reply.status(200).send({ ok: true });
  }));

  // ---- demo and settings -----------------------------------------------------------------
  app.post("/api/demo/:runId/scenario", wrap(async (req) => {
    const p = await auth(req);
    const { runId } = req.params as { runId: string };
    await authorizeRun(db, p, runId);
    const { scenario } = z.object({ scenario: z.enum(["win", "lose", "mismatch"]) }).parse(req.body);
    return simulate(db, runId, scenario);
  }));

  app.get("/api/settings/connections", wrap(async (req) => {
    await auth(req);
    let gemini: Record<string, unknown> = { configured: !!deps.trading };
    if (deps.trading) {
      try {
        const c = await deps.trading();
        const [terms, balance] = await Promise.all([getTermsStatus(c), getUsdBalance(c)]);
        gemini = { ...gemini, reachable: true, terms, balance };
      } catch (e) {
        gemini = { ...gemini, reachable: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
    const [acct] = await db`select blocked_by_order_id, blocked_reason from exchange_accounts where id = 'sandbox-primary'`;
    return { environment: "sandbox", context: { configured: cfg.providers.context }, agent: { configured: cfg.providers.agent, model: cfg.AGENT_MODEL }, gemini, account: acct, accountStream: deps.accountStream?.status ?? null };
  }));

  app.get("/api/settings/terms", wrap(async (req) => {
    await auth(req);
    if (!deps.trading) throw new DomainError("PROVIDER_UNAVAILABLE", "Gemini not configured");
    return getTermsDocument(await deps.trading());
  }));

  // Only the account owner, on an explicit click, after reading the terms.
  app.post("/api/settings/terms/accept", wrap(async (req) => {
    const p = await auth(req);
    const owners = await db`select 1 from memberships where user_id = ${p.userId} and role = 'owner'`;
    if (!owners.length) throw new DomainError("FORBIDDEN", "only an account owner can accept exchange terms");
    if (!deps.trading) throw new DomainError("PROVIDER_UNAVAILABLE", "Gemini not configured");
    z.object({ confirm: z.literal(true) }).parse(req.body);
    await acceptTermsOnOwnerConsent(await deps.trading());
    return { ok: true };
  }));

  return app;
}
