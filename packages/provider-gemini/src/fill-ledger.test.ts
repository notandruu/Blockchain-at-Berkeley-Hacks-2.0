import { describe, expect, it } from "vitest";
import { FillLedger } from "./fill-ledger.js";

const id = "73797746498585286";

describe("FillLedger", () => {
  it("counts a fully filled IOC that terminates CANCELED exactly once", () => {
    const l = new FillLedger(id);
    l.apply({ orderId: id, status: "NEW", eventTimeNs: "1" });
    l.apply({ orderId: id, status: "PARTIALLY_FILLED", executedQuantity: "6", lastPrice: "0.40", tradeId: "t1", fee: "0.11", maker: false, eventTimeNs: "2" });
    l.apply({ orderId: id, status: "FILLED", executedQuantity: "4", lastPrice: "0.41", tradeId: "t2", fee: "0.07", maker: false, eventTimeNs: "3" });
    // terminal event carries the cumulative 10, which must not be added to 6 + 4
    l.apply({ orderId: id, status: "CANCELED", executedQuantity: "10", reason: "ImmediateOrCancelWouldPost", eventTimeNs: "4" });
    const s = l.state();
    expect(s.confirmedQuantity.toString()).toBe("10");
    expect(s.principal.toString()).toBe("4.04");
    expect(s.fees.toString()).toBe("0.18");
    expect(s.missingFills).toBe(false);
    expect(s.terminal).toBe(true);
  });

  it("ignores a replayed fill with the same trade id", () => {
    const l = new FillLedger(id);
    const fill = { orderId: id, status: "PARTIALLY_FILLED" as const, executedQuantity: "5", lastPrice: "0.5", tradeId: "t1", fee: "0.09", eventTimeNs: "2" };
    l.apply(fill);
    l.apply(fill);
    expect(l.state().confirmedQuantity.toString()).toBe("5");
  });

  it("trusts the terminal cumulative when fills were missed and flags it", () => {
    const l = new FillLedger(id);
    l.apply({ orderId: id, status: "PARTIALLY_FILLED", executedQuantity: "3", lastPrice: "0.5", tradeId: "t1", eventTimeNs: "2" });
    l.apply({ orderId: id, status: "CANCELED", executedQuantity: "8", eventTimeNs: "5" });
    const s = l.state();
    expect(s.confirmedQuantity.toString()).toBe("8");
    expect(s.missingFills).toBe(true);
    expect(s.feesComplete).toBe(false);
  });

  it("treats a FOK that would not fill as zero coverage", () => {
    const l = new FillLedger(id);
    l.apply({ orderId: id, status: "NEW", eventTimeNs: "1" });
    l.apply({ orderId: id, status: "CANCELED", reason: "FillOrKillWouldNotFill", eventTimeNs: "2" });
    const s = l.state();
    expect(s.confirmedQuantity.toString()).toBe("0");
    expect(s.reason).toBe("FillOrKillWouldNotFill");
  });
});
