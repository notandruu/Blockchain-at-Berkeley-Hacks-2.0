import { dec, type Dec, ZERO } from "@riskpilot/risk-engine";

// Order stream semantics, from developer.gemini.com/prediction-markets/websocket/streams:
//   - On FILLED / PARTIALLY_FILLED events, Z is the quantity of *that execution*, n is its fee,
//     L its price and t its trade id.
//   - On CANCELED and other terminal events, Z is the *cumulative* executed quantity.
//   - A fully filled IOC terminates as CANCELED. Status never says how much filled; Z does.
// So: sum unique fills by trade id, treat terminal Z as a cumulative cross-check, and never
// add the terminal cumulative on top of fills already counted.

export interface OrderStreamEvent {
  orderId: string;
  status: "NEW" | "OPEN" | "FILLED" | "PARTIALLY_FILLED" | "CANCELED" | "REJECTED" | "MODIFIED";
  executedQuantity?: string; // Z
  lastPrice?: string; // L
  tradeId?: string; // t
  fee?: string; // n
  maker?: boolean; // m
  reason?: string; // r
  eventTimeNs: string; // E
}

export interface LedgerFill {
  tradeId: string;
  quantity: Dec;
  price: Dec;
  fee: Dec | null;
  maker: boolean | null;
}

export interface LedgerState {
  orderId: string;
  fills: LedgerFill[];
  fillQuantity: Dec;
  terminalCumulative: Dec | null;
  confirmedQuantity: Dec;
  principal: Dec;
  fees: Dec;
  feesComplete: boolean;
  terminal: boolean;
  status: OrderStreamEvent["status"] | null;
  reason: string | null;
  // True when the terminal cumulative says more filled than the fills we saw. The missing
  // executions must come from REST reconciliation before capacity is published.
  missingFills: boolean;
}

export class FillLedger {
  private readonly fills = new Map<string, LedgerFill>();
  private terminalCumulative: Dec | null = null;
  private status: OrderStreamEvent["status"] | null = null;
  private reason: string | null = null;

  constructor(readonly orderId: string) {}

  apply(e: OrderStreamEvent): void {
    if (e.orderId !== this.orderId) return;
    this.status = e.status;
    if (e.reason) this.reason = e.reason;
    if ((e.status === "FILLED" || e.status === "PARTIALLY_FILLED") && e.executedQuantity) {
      // Without a trade id we cannot dedupe a replayed event; key on event time instead,
      // which is unique per execution on this stream.
      const key = e.tradeId ?? `E:${e.eventTimeNs}`;
      if (this.fills.has(key)) return;
      this.fills.set(key, {
        tradeId: key,
        quantity: dec(e.executedQuantity),
        price: dec(e.lastPrice ?? "0"),
        fee: e.fee != null ? dec(e.fee) : null,
        maker: e.maker ?? null,
      });
      return;
    }
    if ((e.status === "CANCELED" || e.status === "REJECTED") && e.executedQuantity) {
      const z = dec(e.executedQuantity);
      this.terminalCumulative = this.terminalCumulative ? (z.gt(this.terminalCumulative) ? z : this.terminalCumulative) : z;
    }
  }

  state(): LedgerState {
    const fills = [...this.fills.values()];
    const fillQuantity = fills.reduce((s, f) => s.plus(f.quantity), ZERO);
    const confirmedQuantity =
      this.terminalCumulative && this.terminalCumulative.gt(fillQuantity) ? this.terminalCumulative : fillQuantity;
    const terminal = this.status === "FILLED" || this.status === "CANCELED" || this.status === "REJECTED";
    return {
      orderId: this.orderId,
      fills,
      fillQuantity,
      terminalCumulative: this.terminalCumulative,
      confirmedQuantity,
      principal: fills.reduce((s, f) => s.plus(f.quantity.mul(f.price)), ZERO),
      fees: fills.reduce((s, f) => s.plus(f.fee ?? ZERO), ZERO),
      feesComplete: fills.every((f) => f.fee !== null),
      terminal,
      status: this.status,
      reason: this.reason,
      missingFills: this.terminalCumulative !== null && this.terminalCumulative.gt(fillQuantity),
    };
  }
}
