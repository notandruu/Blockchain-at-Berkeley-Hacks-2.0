import { AcceptTermsRequired, ApiError, InsufficientFunds, ValidationError } from "@gemini-markets/sdk/server";
import type { Outcome } from "@beagle/domain";
import type { GeminiClient } from "./client.js";

// The only path in the codebase that sends a financial write to Gemini. It takes an order
// built from a stored, approved plan, never from browser input, and it never retries.

export interface ApprovedOrder {
  symbol: string;
  outcome: Outcome;
  quantity: string;
  limitPrice: string;
  timeInForce: "fill-or-kill" | "immediate-or-cancel";
}

export type SubmitResult =
  | {
      kind: "accepted";
      orderId: string;
      status: string;
      filledQuantity: string;
      remainingQuantity: string;
      avgExecutionPrice: string | null;
      raw: Record<string, unknown>;
    }
  // The exchange answered with a definitive refusal. Nothing was created.
  | { kind: "rejected"; httpStatus: number | null; code: string; message: string }
  // We do not know whether an order exists. Funds stay reserved; reconcile, never resend.
  | { kind: "unknown"; reason: string };

export function orderPayload(o: ApprovedOrder) {
  // Field names verified against OrderRequest in @gemini-markets/sdk 0.1.1. No client order
  // id: the REST OrderRequest does not document one, so we do not invent it.
  return {
    symbol: o.symbol,
    orderType: "limit" as const,
    side: "buy" as const,
    outcome: o.outcome,
    quantity: o.quantity,
    price: o.limitPrice,
    timeInForce: o.timeInForce,
    makerOrCancel: false,
  };
}

// BigInt order ids must become strings before anything JSON-serializes them. A serializer
// crash after a successful submit would otherwise make a real order look unsubmitted.
export function idToString(v: unknown): string {
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return Number.isSafeInteger(v) ? String(v) : BigInt(Math.trunc(v)).toString();
  return String(v);
}

function stringifyBigInts(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(stringifyBigInts);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, stringifyBigInts(v)]));
  }
  return value;
}

export function classifySubmitError(err: unknown): SubmitResult {
  // Caught by the SDK's own schema check before any bytes left the process.
  if (err instanceof ValidationError) {
    return { kind: "rejected", httpStatus: null, code: "INVALID_ORDER", message: `${err.field}: ${err.message}` };
  }
  if (err instanceof AcceptTermsRequired) {
    return { kind: "rejected", httpStatus: err.status, code: "TERMS_NOT_ACCEPTED", message: err.message };
  }
  if (err instanceof InsufficientFunds) {
    return { kind: "rejected", httpStatus: err.status, code: "INSUFFICIENT_BALANCE", message: err.message };
  }
  // 4xx other than 408/429 is a definitive refusal: no order was created.
  if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
    return { kind: "rejected", httpStatus: err.status, code: err.reason ?? String(err.code), message: err.message };
  }
  // Timeouts, aborts, dropped connections, 5xx, 408 and 429 after the request was sent:
  // an order may or may not exist.
  const e = err as { name?: string; message?: string; status?: number };
  return { kind: "unknown", reason: `${e.name ?? "Error"}: ${e.message ?? String(err)}${e.status ? ` (HTTP ${e.status})` : ""}` };
}

export async function submitApprovedOrder(client: GeminiClient, order: ApprovedOrder, timeoutMs = 10_000): Promise<SubmitResult> {
  try {
    const res = (await client.predictions.placeOrder(orderPayload(order) as never, { timeoutMs } as never)) as Record<string, unknown>;
    const raw = stringifyBigInts(res) as Record<string, unknown>;
    if (res.orderId == null) return { kind: "unknown", reason: "exchange response had no orderId" };
    return {
      kind: "accepted",
      orderId: idToString(res.orderId),
      status: String(res.status ?? "unknown"),
      filledQuantity: String(res.filledQuantity ?? "0"),
      remainingQuantity: String(res.remainingQuantity ?? order.quantity),
      avgExecutionPrice: res.avgExecutionPrice != null ? String(res.avgExecutionPrice) : null,
      raw,
    };
  } catch (err) {
    return classifySubmitError(err);
  }
}
