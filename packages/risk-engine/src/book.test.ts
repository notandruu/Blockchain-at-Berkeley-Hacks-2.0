import { describe, expect, it } from "vitest";
import { dec } from "./decimal.js";
import { executableAsks, walkBook } from "./book.js";

// Captured from the sandbox on 2026-10-11 (GEMI-XRP2610112300-HI1D40).
const depth = {
  bids: [
    { price: "0.7100", quantity: "7.00" },
    { price: "0.7000", quantity: "7.00" },
    { price: "0.6700", quantity: "43.00" },
  ],
  asks: [
    { price: "0.8300", quantity: "7.00" },
    { price: "0.8100", quantity: "7.00" },
    { price: "0.8600", quantity: "14.00" },
  ],
};

describe("executableAsks", () => {
  it("sorts YES asks cheapest first", () => {
    expect(executableAsks(depth, "yes").map((l) => l.price.toString())).toEqual(["0.81", "0.83", "0.86"]);
  });

  it("turns YES bids into NO asks at 1 - p, best bid first", () => {
    const no = executableAsks(depth, "no");
    expect(no.map((l) => l.price.toString())).toEqual(["0.29", "0.3", "0.33"]);
    expect(no.map((l) => l.quantity.toString())).toEqual(["7", "7", "43"]);
  });

  it("does not price NO off the YES ask", () => {
    // 1 - best YES ask would be 0.19, which is not executable.
    expect(executableAsks(depth, "no")[0]!.price.toString()).not.toBe("0.19");
  });
});

describe("walkBook", () => {
  it("never extrapolates past observed levels", () => {
    const w = walkBook(executableAsks(depth, "yes"), dec(100), dec("0.90"), dec("0.01"));
    expect(w.filledQuantity.toString()).toBe("28");
    expect(w.availableUnderLimit.toString()).toBe("28");
  });

  it("stops at the limit price", () => {
    const w = walkBook(executableAsks(depth, "yes"), dec(20), dec("0.83"), dec("0.01"));
    expect(w.filledQuantity.toString()).toBe("14");
    expect(w.worstPrice!.toString()).toBe("0.83");
    expect(w.principal.toString()).toBe("11.48");
  });

  it("respects the quantity increment", () => {
    const w = walkBook([{ price: dec("0.5"), quantity: dec("3.456") }], dec(10), dec("0.6"), dec("0.01"));
    expect(w.filledQuantity.toString()).toBe("3.45");
  });
});
