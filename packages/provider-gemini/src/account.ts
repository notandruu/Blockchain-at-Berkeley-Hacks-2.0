import type { Outcome } from "@beagle/domain";
import type { GeminiClient } from "./client.js";
import { idToString } from "./executor.js";

export interface TermsStatus {
  hasAcceptedLatest: boolean;
  acceptedVersion: number | null;
  latestVersion: number | null;
}

export async function getTermsStatus(client: GeminiClient): Promise<TermsStatus> {
  const r = (await client.predictions.getPredictionMarketsTermsStatus()) as {
    hasAcceptedLatest?: boolean;
    acceptedVersion?: number | null;
    latestVersion?: number | null;
  };
  return { hasAcceptedLatest: !!r.hasAcceptedLatest, acceptedVersion: r.acceptedVersion ?? null, latestVersion: r.latestVersion ?? null };
}

// Terms are presented to a human and accepted only on their explicit click. Nothing in the
// agent or executor calls these.
export async function getTermsDocument(client: GeminiClient) {
  return (await client.predictions.getPredictionMarketsTerms()) as { termsType: string; version: number; content: string; updatedAt: string };
}
export async function acceptTermsOnOwnerConsent(client: GeminiClient) {
  return client.predictions.acceptTerms();
}

export async function getUsdBalance(client: GeminiClient): Promise<{ available: string; total: string } | null> {
  const rows = (await client.account.getAvailableBalances({} as never)) as unknown as { currency?: string; available?: string; amount?: string }[];
  const usd = (rows ?? []).find((r) => (r.currency ?? "").toUpperCase() === "USD");
  return usd ? { available: usd.available ?? "0", total: usd.amount ?? usd.available ?? "0" } : null;
}

export interface ExchangeOrder {
  orderId: string;
  symbol: string;
  status: string;
  side: string;
  outcome: Outcome | null;
  quantity: string;
  filledQuantity: string;
  remainingQuantity: string;
  price: string;
  avgExecutionPrice: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function toOrder(o: Record<string, unknown>): ExchangeOrder {
  return {
    orderId: idToString(o.orderId),
    symbol: String(o.symbol ?? ""),
    status: String(o.status ?? "unknown"),
    side: String(o.side ?? ""),
    outcome: (o.outcome as Outcome) ?? null,
    quantity: String(o.quantity ?? "0"),
    filledQuantity: String(o.filledQuantity ?? "0"),
    remainingQuantity: String(o.remainingQuantity ?? "0"),
    price: String(o.price ?? "0"),
    avgExecutionPrice: o.avgExecutionPrice != null ? String(o.avgExecutionPrice) : null,
    createdAt: (o.createdAt as string) ?? null,
    updatedAt: (o.updatedAt as string) ?? null,
  };
}

export async function listActiveOrders(client: GeminiClient, symbol?: string): Promise<ExchangeOrder[]> {
  const out: ExchangeOrder[] = [];
  for await (const o of client.predictions.iterateActiveOrders((symbol ? { symbol } : {}) as never)) out.push(toOrder(o as Record<string, unknown>));
  return out;
}

export async function listOrderHistory(client: GeminiClient, opts: { symbol?: string; fromMs?: number }): Promise<ExchangeOrder[]> {
  const input: Record<string, unknown> = { limit: 200 };
  if (opts.symbol) input.symbol = opts.symbol;
  if (opts.fromMs) {
    input.from = BigInt(opts.fromMs);
    input.to = BigInt(Date.now() + 60_000);
  }
  const res = (await client.predictions.getOrderHistory(input as never)) as { orders?: Record<string, unknown>[] };
  return (res.orders ?? []).map(toOrder);
}

export interface ExchangePosition {
  symbol: string;
  outcome: Outcome | null;
  totalQuantity: string;
  quantityOnHold: string;
  avgPrice: string | null;
  marketValue: string | null;
  resolutionSide: string | null;
}

export async function listPositions(client: GeminiClient): Promise<ExchangePosition[]> {
  const out: ExchangePosition[] = [];
  for await (const p of client.predictions.iteratePositions({ limit: 200 } as never)) {
    const r = p as Record<string, unknown>;
    out.push({
      symbol: String(r.symbol ?? (r.contractMetadata as Record<string, unknown> | undefined)?.instrumentSymbol ?? ""),
      outcome: (r.outcome as Outcome) ?? null,
      totalQuantity: String(r.totalQuantity ?? "0"),
      quantityOnHold: String(r.quantityOnHold ?? "0"),
      avgPrice: r.avgPrice != null ? String(r.avgPrice) : null,
      marketValue: r.marketValue != null ? String(r.marketValue) : null,
      resolutionSide: (r.resolutionSide as string) ?? null,
    });
  }
  return out;
}

export interface SettledPositionRecord {
  instrumentSymbol: string;
  outcome: Outcome | null;
  positionQuantity: string;
  payout: string;
  resolutionSide: string | null;
  settledAt: string | null;
  costBasis: string | null;
}

export async function listSettledPositions(client: GeminiClient): Promise<SettledPositionRecord[]> {
  const out: SettledPositionRecord[] = [];
  for await (const p of client.predictions.iterateSettledPositions({} as never)) {
    const r = p as Record<string, unknown>;
    out.push({
      instrumentSymbol: String(r.instrumentSymbol ?? ""),
      outcome: (r.outcome as Outcome) ?? null,
      positionQuantity: String(r.positionQuantity ?? "0"),
      payout: String(r.payout ?? "0"),
      resolutionSide: (r.resolutionSide as string) ?? null,
      settledAt: (r.settledAt as string) ?? null,
      costBasis: r.costBasis != null ? String(r.costBasis) : null,
    });
  }
  return out;
}

// After an ambiguous submit we look for our order without a client id. A match must agree
// on symbol, side, outcome, quantity and price and fall inside the submit window. More than
// one match is still ambiguous and stays EXECUTION_UNKNOWN for an operator.
export function findSubmittedOrder(
  orders: ExchangeOrder[],
  want: { symbol: string; outcome: Outcome; quantity: string; limitPrice: string; submittedAtMs: number; windowMs: number },
): { match: ExchangeOrder | null; ambiguous: boolean } {
  const same = (a: string, b: string) => Number(a) === Number(b);
  const hits = orders.filter(
    (o) =>
      o.symbol === want.symbol &&
      o.side.toLowerCase() === "buy" &&
      o.outcome === want.outcome &&
      same(o.quantity, want.quantity) &&
      same(o.price, want.limitPrice) &&
      o.createdAt !== null &&
      Math.abs(new Date(o.createdAt).getTime() - want.submittedAtMs) <= want.windowMs,
  );
  return { match: hits.length === 1 ? hits[0]! : null, ambiguous: hits.length > 1 };
}
