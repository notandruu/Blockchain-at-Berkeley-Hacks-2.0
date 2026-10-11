import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sql } from "../db.js";
import { signedArtifactUrl } from "../storage.js";

// The authorized user's current persisted view of a run. Everything the workspace renders on
// load comes from here; live updates arrive as events on top of it.
export async function runView(db: Sql, admin: SupabaseClient, runId: string) {
  const [run] = await db`
    select id, merchant_id, goal, business_url, inputs, state, mode, research_credits_used, research_credit_ceiling,
      model_input_tokens, model_output_tokens, error_code, error_message, created_at, updated_at
    from runs where id = ${runId}`;
  const sources = await db<{ id: string; screenshot_artifact_id: string | null }[]>`
    select id, requested_url, final_url, domain, title, objective, capture_status, screenshot_artifact_id, context_request_id,
      cache_status, cache_age_ms, source_published_at, retrieved_at, left(markdown_excerpt, 4000) as excerpt
    from sources where run_id = ${runId} order by retrieved_at`;
  const withUrls = await Promise.all(
    sources.map(async (s) => ({ ...s, screenshotUrl: s.screenshot_artifact_id ? await signedArtifactUrl(admin, db, s.screenshot_artifact_id) : null })),
  );
  const evidence = await db`select id, source_id, provenance, claim, passage, created_at from evidence where run_id = ${runId} order by created_at`;
  const matches = await db`
    select instrument_symbol, environment, event_ticker, label, match_type, executable, outcome, checks, rejections, caveats,
      candidate->>'eventTitle' as event_title, candidate->>'expiryDate' as expiry_date
    from contract_matches where run_id = ${runId}
    order by case match_type when 'exact' then 0 when 'proxy' then 1 when 'unknown' then 2 else 3 end, executable desc limit 40`;
  const plans = await db`select id, version, status, body, plan_hash, max_debit_usd, expires_at, last_quote_check, created_at from plans where run_id = ${runId} order by version`;
  const orders = await db`
    select o.id, o.state, o.symbol, o.outcome, o.quantity, o.limit_price, o.exchange_order_id, o.exchange_status, o.filled_quantity,
      o.avg_price, o.principal_usd, o.fees_usd, o.fees_source, o.submitted_at, o.reconciled_at, o.reject_code, o.reject_message,
      r.reserved_usd, r.spent_usd, r.status as reservation_status
    from exchange_orders o join plans p on p.id = o.plan_id
    left join budget_reservations r on r.approval_id = o.approval_id
    where p.run_id = ${runId} order by o.created_at`;
  const campaigns = await db`
    select c.id, c.slug, c.public_token, c.venue_name, c.headline, c.qualification, c.reward_usd, c.max_entitlements, c.status, c.closes_at,
      h.confirmed_units, h.allocated_units, h.held_units,
      (select count(*)::int from entitlements e where e.campaign_id = c.id) as claimed
    from campaigns c join plans p on p.id = c.plan_id left join holdings h on h.id = c.holding_id
    where p.run_id = ${runId}`;
  const calls = await db`select provider, operation, count(*)::int as n, sum(credits)::text as credits, avg(latency_ms)::int as avg_ms from provider_calls where run_id = ${runId} group by provider, operation`;
  return { run, sources: withUrls, evidence, matches, plans, orders, campaigns, providerCalls: calls };
}
