import type { DepthSnapshot, ExchangeEnvironment, MarketCandidate } from "@riskpilot/domain";
import type { GeminiClient } from "./client.js";
import { normalizeEvent, type RawEvent } from "./normalize.js";

export interface InventoryQuery {
  categories?: string[];
  // Server-side title search (the API's `search` parameter).
  search?: string;
  maxEvents?: number;
}

export interface InventoryResult {
  environment: ExchangeEnvironment;
  fetchedAt: string;
  eventsScanned: number;
  candidates: MarketCandidate[];
  categoriesAvailable: string[];
  // Requested categories with no active events in this environment, e.g. Sports on sandbox.
  categoriesMissing: string[];
}

export async function listCategories(client: GeminiClient): Promise<string[]> {
  const res = (await client.predictions.getCategories()) as { categories?: string[] };
  return res.categories ?? [];
}

// Discover active inventory. Paginates through the SDK iterator rather than trusting a
// single page, and keeps the environment on every candidate.
export async function discoverInventory(
  client: GeminiClient,
  environment: ExchangeEnvironment,
  q: InventoryQuery,
): Promise<InventoryResult> {
  const categoriesAvailable = await listCategories(client);
  const requested = q.categories ?? [];
  const categories = requested.filter((c) => categoriesAvailable.includes(c));
  const categoriesMissing = requested.filter((c) => !categoriesAvailable.includes(c));
  const result: InventoryResult = { environment, fetchedAt: new Date().toISOString(), eventsScanned: 0, candidates: [], categoriesAvailable, categoriesMissing };
  // Every requested category is absent: nothing to scan, and saying so is the answer.
  if (requested.length && !categories.length) return result;

  // The server-side `category` and `search` filters exceeded a 30s deadline on sandbox
  // (2026-10-11) while unfiltered pages return in ~0.5s. Paginate unfiltered and filter here.
  const needle = q.search?.toLowerCase();
  for await (const ev of client.predictions.iterateEvents({ status: ["active"] } as never, { limit: 100, maxItems: q.maxEvents ?? 1500 })) {
    result.eventsScanned++;
    const raw = ev as unknown as RawEvent;
    if (categories.length && !categories.includes(raw.category ?? "")) continue;
    if (needle && !(raw.title ?? "").toLowerCase().includes(needle) && !(raw.ticker ?? "").toLowerCase().includes(needle)) continue;
    result.candidates.push(...normalizeEvent(raw, environment));
  }
  // A category can be listed by getCategories and still have zero active events.
  result.categoriesMissing.push(...categories.filter((c) => !result.candidates.some((k) => k.category === c)));
  return result;
}

export async function getEventCandidates(client: GeminiClient, environment: ExchangeEnvironment, eventTicker: string): Promise<MarketCandidate[]> {
  const ev = (await client.predictions.getEvent({ eventTicker } as never)) as unknown as RawEvent;
  return normalizeEvent(ev, environment);
}

// One fresh snapshot. The quote engine only uses these levels and never extrapolates.
export async function fetchDepth(client: GeminiClient, environment: ExchangeEnvironment, instrumentSymbol: string): Promise<DepthSnapshot> {
  const res = (await client.websocket.public.depthSnapshot(instrumentSymbol)) as unknown as {
    lastUpdateId?: number | bigint;
    bids?: [string, string][];
    asks?: [string, string][];
    result?: { lastUpdateId?: number | bigint; bids?: [string, string][]; asks?: [string, string][] };
  };
  const body = res.result ?? res;
  return {
    instrumentSymbol,
    environment,
    bids: (body.bids ?? []).map(([price, quantity]) => ({ price, quantity })),
    asks: (body.asks ?? []).map(([price, quantity]) => ({ price, quantity })),
    observedAt: new Date().toISOString(),
    lastUpdateId: body.lastUpdateId != null ? String(body.lastUpdateId) : null,
  };
}
