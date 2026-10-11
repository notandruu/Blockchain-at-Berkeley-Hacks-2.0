import { describe, expect, it } from "vitest";
import { AcceptTermsRequired, ApiError, RequestTimeoutError } from "@gemini-markets/sdk/server";
import { classifySubmitError, idToString, orderPayload } from "./executor.js";
import { findSubmittedOrder, type ExchangeOrder } from "./account.js";

describe("orderPayload", () => {
  it("uses only documented OrderRequest fields", () => {
    const p = orderPayload({ symbol: "GEMI-X", outcome: "yes", quantity: "40", limitPrice: "0.41", timeInForce: "fill-or-kill" });
    expect(Object.keys(p).sort()).toEqual(["makerOrCancel", "orderType", "outcome", "price", "quantity", "side", "symbol", "timeInForce"]);
    expect(p).toMatchObject({ orderType: "limit", side: "buy", makerOrCancel: false });
  });
});

describe("idToString", () => {
  it("keeps 64-bit order ids exact", () => {
    expect(idToString(73797746498585286n)).toBe("73797746498585286");
  });
});

describe("classifySubmitError", () => {
  it("treats a timeout as unknown, never as rejected", () => {
    expect(classifySubmitError(new RequestTimeoutError("deadline")).kind).toBe("unknown");
  });

  it("treats a dropped connection as unknown", () => {
    expect(classifySubmitError(new TypeError("fetch failed")).kind).toBe("unknown");
  });

  it("surfaces terms acceptance as a rejection the operator must resolve", () => {
    const e = Object.create(AcceptTermsRequired.prototype) as AcceptTermsRequired;
    Object.assign(e, { status: 403, message: "terms" });
    const r = classifySubmitError(e);
    expect(r).toMatchObject({ kind: "rejected", code: "TERMS_NOT_ACCEPTED" });
  });

  it("treats a 503 as unknown", () => {
    const e = Object.create(ApiError.prototype) as ApiError;
    Object.assign(e, { status: 503, message: "unavailable" });
    expect(classifySubmitError(e).kind).toBe("unknown");
  });
});

describe("findSubmittedOrder", () => {
  const base: ExchangeOrder = { orderId: "1", symbol: "GEMI-X", status: "cancelled", side: "buy", outcome: "yes", quantity: "40", filledQuantity: "40", remainingQuantity: "0", price: "0.41", avgExecutionPrice: "0.40", createdAt: "2026-10-11T22:00:01.000Z", updatedAt: null };
  const want = { symbol: "GEMI-X", outcome: "yes" as const, quantity: "40.00", limitPrice: "0.41", submittedAtMs: Date.parse("2026-10-11T22:00:00.000Z"), windowMs: 30_000 };

  it("recovers a single matching order", () => {
    expect(findSubmittedOrder([base], want).match?.orderId).toBe("1");
  });

  it("refuses to guess between two identical orders", () => {
    const r = findSubmittedOrder([base, { ...base, orderId: "2" }], want);
    expect(r.match).toBeNull();
    expect(r.ambiguous).toBe(true);
  });
});
