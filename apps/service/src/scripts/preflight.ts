import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256, type Trigger } from "@riskpilot/domain";
import { ContextResearch } from "@riskpilot/provider-context";
import {
  createPublicClient,
  createTradingClient,
  discoverInventory,
  fetchDepth,
  getTermsStatus,
  getUsdBalance,
} from "@riskpilot/provider-gemini";
import { matchCandidate, PUBLISHED_FEE_SCHEDULE, quotePromotion } from "@riskpilot/risk-engine";
import { loadConfig } from "../config.js";

// Phase 0 of the PRD: prove both sponsor integrations against the same sandbox the demo
// will use, and write a manifest of what was actually observed. The manifest is config,
// never fabricated market data: every number below comes from a request made in this run.
//
//   pnpm preflight                 read-only checks
//   pnpm preflight --reward 20 --entitlements 10 --budget 350 --ceiling 0.65

const cfg = loadConfig();
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
};
const reward = arg("reward", "20");
const entitlements = Number(arg("entitlements", "10"));
const budget = arg("budget", "350");
const ceiling = arg("ceiling", "0.65");
const asset = arg("asset", "BTC");
// Enrollment needs time before settlement; contracts closer than this are skipped.
const minHours = Number(arg("min-hours", "2"));

const log = (step: string, detail: unknown) => console.log(`\n▸ ${step}\n${typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)}`);

const manifest: Record<string, unknown> = { generatedAt: new Date().toISOString(), environment: cfg.GEMINI_ENV, params: { reward, entitlements, budget, ceiling, asset, minHours } };

// 1. Inventory in both environments.
const sandbox = await createPublicClient("sandbox");
const inv = await discoverInventory(sandbox, "sandbox", { categories: ["Crypto", "Sports", "Weather"] });
const byCategory = inv.candidates.reduce<Record<string, number>>((m, c) => ((m[c.category] = (m[c.category] ?? 0) + 1), m), {});
log("sandbox inventory", { eventsScanned: inv.eventsScanned, contractsByCategory: byCategory, categoriesWithNoEvents: inv.categoriesMissing });
manifest.inventory = { eventsScanned: inv.eventsScanned, contractsByCategory: byCategory, categoriesWithNoEvents: inv.categoriesMissing };

// 2. Every daily price-threshold event for the asset that settles at least a day out.
const minExpiry = Date.now() + minHours * 3600_000;
const events = [...new Set(inv.candidates.filter((c) => c.eventTicker.startsWith(asset) && !/\d{2}M\d/.test(c.eventTicker) && c.expiryDate && Date.parse(c.expiryDate) > minExpiry).map((c) => c.eventTicker))];
log(`${asset} events settling after ${new Date(minExpiry).toISOString()}`, events);

// 3. For each strike: exact-match check, fresh depth, deterministic promotion quote.
const options: Record<string, unknown>[] = [];
for (const ticker of events) {
  for (const c of inv.candidates.filter((k) => k.eventTicker === ticker && k.strike?.type === "above")) {
    const trigger: Trigger = { kind: "price_threshold", asset, operator: "gte", threshold: c.strike!.value!, thresholdUpper: null, observationTime: c.expiryDate!, settlementIndex: c.settlementSource };
    const m = matchCandidate(trigger, c, new Date());
    if (!m.executable || !m.outcome) continue;
    const depth = await fetchDepth(sandbox, "sandbox", c.instrumentSymbol);
    const q = quotePromotion({ depth, outcome: m.outcome, grid: c, fees: PUBLISHED_FEE_SCHEDULE, priceCeiling: ceiling, budgetUsd: budget, feeBoundFillUnit: cfg.FEE_BOUND_FILL_UNIT, now: new Date() }, reward, entitlements);
    options.push({
      symbol: c.instrumentSymbol,
      label: c.label,
      expiry: c.expiryDate,
      rulesHash: c.rulesHash,
      observedAt: depth.observedAt,
      lastUpdateId: depth.lastUpdateId,
      asksTop: depth.asks.slice(0, 3),
      bidsTop: depth.bids.slice(0, 3),
      entitlements: q.entitlements,
      reason: q.reason,
      quote: q.quote && { quantity: q.quote.quantity, limit: q.quote.limitPrice, est: q.quote.estimatedDebitUsd, max: q.quote.maxDebitUsd, avg: q.quote.averagePrice },
    });
  }
}
const viable = options.filter((o) => (o.entitlements as number) > 0).sort((a, b) => (b.entitlements as number) - (a.entitlements as number));
log("quotable strikes (observed depth, published fees)", viable.length ? viable : "none: the sandbox book has no asks under the ceiling right now");
manifest.options = options;
manifest.selected = viable[0] ?? null;

// 4. Account readiness, only when credentials exist.
if (cfg.providers.gemini) {
  const trading = await createTradingClient(cfg.GEMINI_ENV, { apiKey: cfg.GEMINI_API_KEY, apiSecret: cfg.GEMINI_API_SECRET });
  const [terms, balance] = await Promise.all([getTermsStatus(trading), getUsdBalance(trading)]);
  log("sandbox account", { terms, balance });
  manifest.account = { terms, balance };
} else {
  log("sandbox account", "skipped: GEMINI_API_KEY / GEMINI_API_SECRET not set");
}

// 5. One Context.dev read with a screenshot, checked per output.
if (cfg.providers.context) {
  const ctx = new ContextResearch(cfg.CONTEXT_DEV_API_KEY, { ceiling: 5, used: 0 });
  const termsUrl = inv.candidates.find((c) => c.eventTicker === events[0])?.termsUrl;
  const target = arg("url", "https://www.gemini.com/predictions");
  const r = await ctx.scrape(target, { screenshot: true, highlightsQuery: "How are prediction market contracts settled?", maxAgeMs: 0 });
  const summary = { url: r.finalUrl, requestId: r.receipt.requestId, credits: r.receipt.creditsConsumed, markdown: r.markdown.ok, highlights: r.highlights.ok ? r.highlights.data.length : r.highlights, screenshot: r.screenshot.ok ? `${r.screenshot.data.mime} ${r.screenshot.data.bytes.length} bytes` : r.screenshot, termsUrl };
  log("context.dev scrape", summary);
  manifest.context = summary;
} else {
  log("context.dev", "skipped: CONTEXT_DEV_API_KEY not set");
}

manifest.manifestHash = sha256(canonicalJson(manifest));
const out = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../fixtures/preflight", `manifest-${new Date().toISOString().slice(0, 10)}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(manifest, null, 2));
log("manifest written", out);
process.exit(0);
