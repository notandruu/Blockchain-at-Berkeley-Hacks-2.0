import ContextDev from "context.dev";
import { DomainError } from "@riskpilot/domain";
import { assertPublicUrl, type UrlCheckOptions } from "./url-safety.js";
import { decodeScreenshot, ScreenshotRejected, type DecodedScreenshot } from "./screenshot.js";

// Thin, typed wrapper over the context.dev SDK. Its jobs:
//   1. refuse non-public URLs before spending a credit
//   2. enforce a per-run credit ceiling using the credits the API reports back
//   3. check success per output instead of trusting HTTP 200
//   4. return provenance (request id, cache age, final URL) with every result

export interface CreditMeter {
  ceiling: number;
  used: number;
}

export interface ProviderReceipt {
  provider: "context";
  operation: "search" | "scrape" | "brand" | "styleguide" | "answers" | "monitor";
  requestId: string | null;
  creditsConsumed: number;
  creditsRemaining: number | null;
  cacheStatus: "hit" | "miss" | "zdr" | null;
  cacheAgeMs: number | null;
  latencyMs: number;
}

export interface SearchHit {
  url: string;
  title: string;
  description: string;
  relevance: "high" | "medium" | "low";
  highlights: string[];
  highlightsCode: string;
}

export interface SearchResult {
  query: string;
  hits: SearchHit[];
  partial: boolean;
  receipt: ProviderReceipt;
}

export type OutputStatus<T> = { ok: true; data: T } | { ok: false; requested: boolean; errorCode: string | null; message: string | null };

export interface ScrapeResult {
  requestedUrl: string;
  finalUrl: string;
  title: string | null;
  description: string | null;
  publishedTime: string | null;
  modifiedTime: string | null;
  markdown: OutputStatus<string>;
  highlights: OutputStatus<string[]>;
  screenshot: OutputStatus<DecodedScreenshot>;
  json: OutputStatus<Record<string, unknown>>;
  partial: boolean;
  receipt: ProviderReceipt;
}

export interface ScrapeOptions {
  highlightsQuery?: string;
  screenshot?: boolean;
  // 0 for event-critical facts; otherwise accept the provider cache and show its age.
  maxAgeMs?: number;
  jsonSchema?: Record<string, unknown>;
  jsonInstructions?: string;
}

type Raw<T> = { data: T | null; requested: boolean; success: boolean | null; error_code?: string; message?: string };

function output<T>(o: Raw<T> | undefined): OutputStatus<T> {
  if (o && o.success === true && o.data != null) return { ok: true, data: o.data };
  return { ok: false, requested: !!o?.requested, errorCode: o?.error_code ?? null, message: o?.message ?? null };
}

export class ContextResearch {
  private readonly client: ContextDev;

  constructor(
    apiKey: string,
    readonly meter: CreditMeter,
    private readonly urlOpts: UrlCheckOptions = {},
  ) {
    if (!apiKey) throw new Error("CONTEXT_DEV_API_KEY is not set");
    // Reads retry twice with backoff inside the SDK; we cap credits, not retries.
    this.client = new ContextDev({ apiKey, maxRetries: 2, timeout: 90_000 });
  }

  private ensureBudget(estimate: number): void {
    if (this.meter.used + estimate > this.meter.ceiling) {
      throw new DomainError("BUDGET_EXCEEDED", `research credit ceiling reached (${this.meter.used}/${this.meter.ceiling})`, { meter: this.meter });
    }
  }

  private charge(km: { credits_consumed: number; credits_remaining: number } | undefined, fallback: number): { consumed: number; remaining: number | null } {
    const consumed = km?.credits_consumed ?? fallback;
    this.meter.used += consumed;
    return { consumed, remaining: km?.credits_remaining ?? null };
  }

  async search(query: string, opts: { highlights?: boolean; includeDomains?: string[]; freshness?: "last_24_hours" | "last_week" | "last_month" | "last_year" } = {}): Promise<SearchResult> {
    // Documented minimum is 10 results; 1 credit per 10, +1 for highlights.
    this.ensureBudget(opts.highlights ? 2 : 1);
    const t0 = Date.now();
    const res = await this.client.web.search({
      query,
      numResults: 10,
      country: "us",
      ...(opts.includeDomains?.length ? { includeDomains: opts.includeDomains } : {}),
      ...(opts.freshness ? { freshness: opts.freshness } : {}),
      ...(opts.highlights ? { highlightsOptions: { enabled: true, maxCharacters: 900 } } : {}),
      timeoutOpts: { milliseconds: 30_000, behavior: "return-partial" },
      tags: ["riskpilot"],
    });
    const credits = this.charge(res.key_metadata, opts.highlights ? 2 : 1);
    return {
      query: res.query,
      partial: !!res.partial,
      hits: res.results.map((r) => ({
        url: r.url,
        title: r.title,
        description: r.description,
        relevance: r.relevance,
        highlights: r.highlights?.code === "SUCCESS" ? (r.highlights.highlights ?? []) : [],
        highlightsCode: r.highlights?.code ?? "NOT_REQUESTED",
      })),
      receipt: {
        provider: "context",
        operation: "search",
        requestId: res.request_id,
        creditsConsumed: credits.consumed,
        creditsRemaining: credits.remaining,
        cacheStatus: res.cache_metadata?.status ?? null,
        cacheAgeMs: res.cache_metadata?.age_ms ?? null,
        latencyMs: Date.now() - t0,
      },
    };
  }

  async scrape(rawUrl: string, opts: ScrapeOptions = {}): Promise<ScrapeResult> {
    const url = await assertPublicUrl(rawUrl, this.urlOpts);
    const estimate = 1 + (opts.highlightsQuery ? 1 : 0) + (opts.jsonSchema ? 4 : 0);
    this.ensureBudget(estimate);
    const t0 = Date.now();
    const res = await this.client.web.scrape({
      url: url.toString(),
      formats: {
        markdown: true,
        ...(opts.screenshot ? { screenshot: true } : {}),
        ...(opts.highlightsQuery ? { highlights: true } : {}),
        ...(opts.jsonSchema ? { json: true } : {}),
      },
      ...(opts.highlightsQuery ? { highlightsParams: { query: opts.highlightsQuery, maxCharacters: 1800 } } : {}),
      ...(opts.jsonSchema ? { jsonParams: { schema: opts.jsonSchema, ...(opts.jsonInstructions ? { instructions: opts.jsonInstructions } : {}) } } : {}),
      maxAgeMs: opts.maxAgeMs ?? 0,
      timeoutOpts: { milliseconds: 60_000 },
      tags: ["riskpilot"],
    } as never);
    const credits = this.charge(res.key_metadata, estimate);

    const rawShot = output(res.screenshot as Raw<string>);
    let screenshot: OutputStatus<DecodedScreenshot> = rawShot.ok ? { ok: false, requested: true, errorCode: null, message: null } : rawShot;
    if (rawShot.ok) {
      try {
        screenshot = { ok: true, data: decodeScreenshot(rawShot.data) };
      } catch (e) {
        screenshot = { ok: false, requested: true, errorCode: "REJECTED_BY_APP", message: e instanceof ScreenshotRejected ? e.message : String(e) };
      }
    }
    return {
      requestedUrl: url.toString(),
      finalUrl: res.url,
      title: res.metadata?.title ?? null,
      description: res.metadata?.description ?? null,
      publishedTime: (res.metadata as { publishedTime?: string } | undefined)?.publishedTime ?? null,
      modifiedTime: res.metadata?.modifiedTime ?? null,
      markdown: output(res.markdown as Raw<string>),
      highlights: output(res.highlights as Raw<string[]>),
      screenshot,
      json: output(res.json as Raw<Record<string, unknown>>),
      partial: !!res.isPartial,
      receipt: {
        provider: "context",
        operation: "scrape",
        requestId: res.request_id,
        creditsConsumed: credits.consumed,
        creditsRemaining: credits.remaining,
        cacheStatus: res.cache_metadata?.status ?? null,
        cacheAgeMs: res.cache_metadata?.age_ms ?? null,
        latencyMs: Date.now() - t0,
      },
    };
  }

  // Optional enrichment for the campaign preview. Only allowlisted fields leave this method;
  // no returned CSS or script is ever used.
  async brand(domain: string): Promise<{ name: string | null; logoUrl: string | null; colors: string[]; receipt: ProviderReceipt }> {
    this.ensureBudget(10);
    const t0 = Date.now();
    const res = (await this.client.brand.retrieve({ domain, type: "by_domain" } as never)) as unknown as {
      request_id?: string;
      key_metadata?: { credits_consumed: number; credits_remaining: number };
      brand?: { title?: string; logos?: { url?: string }[]; colors?: { hex?: string }[] };
    };
    const credits = this.charge(res.key_metadata, 10);
    const hex = /^#[0-9a-f]{6}$/i;
    return {
      name: res.brand?.title ?? null,
      logoUrl: res.brand?.logos?.find((l) => l.url?.startsWith("https://"))?.url ?? null,
      colors: (res.brand?.colors ?? []).map((c) => c.hex ?? "").filter((h) => hex.test(h)).slice(0, 4),
      receipt: { provider: "context", operation: "brand", requestId: res.request_id ?? null, creditsConsumed: credits.consumed, creditsRemaining: credits.remaining, cacheStatus: null, cacheAgeMs: null, latencyMs: Date.now() - t0 },
    };
  }

  async createPageMonitor(name: string, url: string, webhookUrl: string, everyHours: number): Promise<{ id: string; secret: string | null }> {
    const safe = await assertPublicUrl(url, this.urlOpts);
    const res = (await this.client.monitors.create({
      name,
      target: { type: "page", url: safe.toString() },
      change_detection: { type: "exact" },
      mode: "web",
      schedule: { type: "interval", frequency: everyHours, unit: "hours" },
      webhook: { url: webhookUrl, retry: {} },
      tags: ["riskpilot"],
    } as never)) as unknown as { id?: string; monitor_id?: string; webhook?: { secret?: string } };
    return { id: res.id ?? res.monitor_id ?? "", secret: res.webhook?.secret ?? null };
  }
}
