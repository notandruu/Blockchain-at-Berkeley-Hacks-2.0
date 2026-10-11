import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainError, type MarketCandidate, type NewRunEvent, type RunEvent } from "@riskpilot/domain";
import type { ContextResearch, ProviderReceipt, ScrapeResult } from "@riskpilot/provider-context";
import { createPublicClient, discoverInventory, type GeminiClient } from "@riskpilot/provider-gemini";
import type { Sql } from "../db.js";
import { appendEvent } from "../events.js";
import { storeScreenshot } from "../storage.js";

// Application tools that wrap verified providers. Each one emits tool.started before the
// provider request, and tool.completed / tool.failed after, so the UI only ever animates
// work that is actually happening. Nothing here can place an order.

export interface StoredSource {
  id: string;
  url: string;
  domain: string;
  title: string | null;
  captureStatus: "screenshot" | "text_only" | "failed";
  text: string;
  highlights: string[];
}

export class ResearchToolkit {
  readonly sources = new Map<string, StoredSource>();
  readonly candidates = new Map<string, MarketCandidate>();
  private publicClients = new Map<string, GeminiClient>();

  constructor(
    private readonly db: Sql,
    private readonly admin: SupabaseClient,
    readonly runId: string,
    private readonly context: ContextResearch | null,
  ) {}

  emit(e: NewRunEvent): Promise<RunEvent> {
    return appendEvent(this.db, this.runId, e);
  }

  private async receipt(r: ProviderReceipt, status: "ok" | "partial" | "error", errorCode: string | null = null): Promise<void> {
    await this.db`
      insert into provider_calls (run_id, provider, operation, request_id, status, credits, latency_ms, error_code)
      values (${this.runId}, ${r.provider}, ${r.operation}, ${r.requestId}, ${status}, ${r.creditsConsumed}, ${r.latencyMs}, ${errorCode})`;
    await this.db`update runs set research_credits_used = research_credits_used + ${Math.ceil(r.creditsConsumed)} where id = ${this.runId}`;
  }

  private requireContext(): ContextResearch {
    if (!this.context) throw new DomainError("PROVIDER_UNAVAILABLE", "Context.dev is not configured (CONTEXT_DEV_API_KEY missing)");
    return this.context;
  }

  async searchEvidence(query: string, objective: string) {
    const ctx = this.requireContext();
    const started = await this.emit({ type: "tool.started", provider: "context", mode: "live_research", title: objective, payload: { tool: "search", query } });
    try {
      const res = await ctx.search(query, { highlights: true });
      await this.receipt(res.receipt, res.partial ? "partial" : "ok");
      await this.emit({
        type: "tool.completed",
        provider: "context",
        mode: "live_research",
        title: `Found ${res.hits.length} results`,
        providerRequestId: res.receipt.requestId,
        payload: {
          tool: "search",
          startedSequence: started.sequence,
          query,
          credits: res.receipt.creditsConsumed,
          latencyMs: res.receipt.latencyMs,
          hits: res.hits.slice(0, 6).map((h) => ({ url: h.url, title: h.title, relevance: h.relevance, snippet: h.description.slice(0, 220) })),
        },
      });
      return res;
    } catch (err) {
      await this.toolFailed("search", started.sequence, err);
      throw err;
    }
  }

  async readSource(url: string, objective: string, highlightsQuery: string, capture = true, maxAgeMs = 0): Promise<StoredSource> {
    const ctx = this.requireContext();
    const domain = safeDomain(url);
    const started = await this.emit({
      type: "tool.started",
      provider: "context",
      mode: "live_research",
      title: objective,
      sourceUrl: url,
      payload: { tool: "scrape", domain, highlightsQuery, screenshot: capture },
    });
    let res: ScrapeResult;
    try {
      res = await ctx.scrape(url, { highlightsQuery, screenshot: capture, maxAgeMs });
    } catch (err) {
      await this.toolFailed("scrape", started.sequence, err, url);
      throw err;
    }
    const text = res.markdown.ok ? res.markdown.data : "";
    const highlights = res.highlights.ok ? res.highlights.data : [];
    let artifactId: string | null = null;
    if (res.screenshot.ok) {
      try {
        artifactId = await storeScreenshot(this.admin, this.db, this.runId, res.screenshot.data);
      } catch {
        artifactId = null;
      }
    }
    // Real capture, text reader fallback, or an explicit failure. Never a fake browser frame.
    const captureStatus = artifactId ? "screenshot" : text || highlights.length ? "text_only" : "failed";
    await this.receipt(res.receipt, captureStatus === "failed" ? "error" : res.partial ? "partial" : "ok");
    const [row] = await this.db<{ id: string }[]>`
      insert into sources (run_id, requested_url, final_url, domain, title, objective, capture_status, screenshot_artifact_id,
        markdown_excerpt, context_request_id, cache_status, cache_age_ms, source_published_at)
      values (${this.runId}, ${res.requestedUrl}, ${res.finalUrl}, ${safeDomain(res.finalUrl)}, ${res.title}, ${objective}, ${captureStatus},
        ${artifactId}, ${text.slice(0, 20000)}, ${res.receipt.requestId}, ${res.receipt.cacheStatus}, ${res.receipt.cacheAgeMs},
        ${toDateOrNull(res.publishedTime ?? res.modifiedTime)})
      returning id`;
    const source: StoredSource = { id: row!.id, url: res.finalUrl, domain: safeDomain(res.finalUrl), title: res.title, captureStatus, text, highlights };
    this.sources.set(source.id, source);

    await this.emit({
      type: captureStatus === "failed" ? "source.capture_failed" : "source.captured",
      provider: "context",
      mode: "live_research",
      title: res.title ?? domain,
      sourceUrl: res.finalUrl,
      artifactId,
      providerRequestId: res.receipt.requestId,
      payload: {
        startedSequence: started.sequence,
        sourceId: source.id,
        domain: source.domain,
        captureStatus,
        cacheStatus: res.receipt.cacheStatus,
        cacheAgeMs: res.receipt.cacheAgeMs,
        credits: res.receipt.creditsConsumed,
        latencyMs: res.receipt.latencyMs,
        outputs: {
          markdown: res.markdown.ok ? "ok" : (res.markdown.errorCode ?? "failed"),
          highlights: res.highlights.ok ? "ok" : (res.highlights.errorCode ?? "failed"),
          screenshot: res.screenshot.ok ? "ok" : (res.screenshot.errorCode ?? "failed"),
        },
        highlights: highlights.slice(0, 4),
      },
    });
    return source;
  }

  // Invariant 7: a claim labelled as observed must quote text that is actually in a stored
  // source. The model cannot launder an inference into a fact.
  async recordEvidence(claim: string, provenance: "source" | "merchant" | "inference", sourceId: string | null, passage: string | null, query: string | null) {
    if (provenance === "source") {
      const src = sourceId ? this.sources.get(sourceId) : undefined;
      if (!src || !passage) throw new DomainError("VALIDATION_FAILED", "observed evidence needs a sourceId and the exact supporting passage");
      const haystack = normalizeWs(`${src.text}\n${src.highlights.join("\n")}`);
      if (!haystack.includes(normalizeWs(passage))) {
        throw new DomainError("VALIDATION_FAILED", "passage was not found in the captured source; record it as an inference instead");
      }
    }
    const [row] = await this.db<{ id: string }[]>`
      insert into evidence (run_id, source_id, provenance, claim, passage, query)
      values (${this.runId}, ${provenance === "source" ? sourceId : null}, ${provenance}, ${claim}, ${passage}, ${query})
      returning id`;
    const src = sourceId ? this.sources.get(sourceId) : undefined;
    await this.emit({
      type: "evidence.added",
      provider: provenance === "source" ? "context" : provenance === "merchant" ? "app" : "agent",
      mode: "live_research",
      title: claim,
      sourceUrl: src?.url ?? null,
      payload: { evidenceId: row!.id, provenance, passage, sourceId, domain: src?.domain ?? null },
    });
    return row!.id;
  }

  async listMarketCandidates(categories: string[], search: string | null, objective: string) {
    const started = await this.emit({
      type: "tool.started",
      provider: "gemini_markets",
      mode: "sandbox_exchange",
      title: objective,
      payload: { tool: "list_market_candidates", categories, search },
    });
    try {
      const envs = ["sandbox", "production"] as const;
      const results = await Promise.all(
        envs.map(async (env) => {
          const c = this.publicClients.get(env) ?? (await createPublicClient(env));
          this.publicClients.set(env, c);
          return discoverInventory(c, env, { categories, ...(search ? { search } : {}) });
        }),
      );
      for (const r of results) for (const c of r.candidates) this.candidates.set(`${c.environment}:${c.instrumentSymbol}`, c);
      const summary = results.map((r) => ({
        environment: r.environment,
        eventsScanned: r.eventsScanned,
        contracts: r.candidates.length,
        categoriesMissing: r.categoriesMissing,
        events: [...new Map(r.candidates.map((c) => [c.eventTicker, c])).values()].slice(0, 25).map((c) => ({
          eventTicker: c.eventTicker,
          title: c.eventTitle,
          expiry: c.expiryDate,
          contracts: r.candidates.filter((k) => k.eventTicker === c.eventTicker).length,
        })),
      }));
      await this.emit({
        type: "market.candidates",
        provider: "gemini_markets",
        mode: "sandbox_exchange",
        title: summary.map((s) => `${s.environment}: ${s.contracts} contracts`).join(" · "),
        payload: { startedSequence: started.sequence, summary },
      });
      return summary;
    } catch (err) {
      await this.toolFailed("list_market_candidates", started.sequence, err);
      throw err;
    }
  }

  eventCandidates(eventTicker: string, environment?: "sandbox" | "production"): MarketCandidate[] {
    return [...this.candidates.values()].filter((c) => c.eventTicker === eventTicker && (!environment || c.environment === environment));
  }

  private async toolFailed(tool: string, startedSequence: number, err: unknown, url?: string) {
    const code = err instanceof DomainError ? err.code : "PROVIDER_UNAVAILABLE";
    await this.emit({
      type: "tool.failed",
      provider: tool === "list_market_candidates" ? "gemini_markets" : "context",
      mode: "live_research",
      title: err instanceof Error ? err.message.slice(0, 200) : "request failed",
      sourceUrl: url ?? null,
      payload: { tool, startedSequence, code },
    });
  }
}

function safeDomain(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function toDateOrNull(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const normalizeWs = (s: string) => s.replace(/[*_`#>\[\]]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
