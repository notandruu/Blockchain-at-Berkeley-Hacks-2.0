import { FillLedger, idToString, type GeminiClient, type OrderStreamEvent } from "@beagle/provider-gemini";

// Authenticated order stream for the sandbox account. It stays on the server. Its only job
// here is to capture per-execution fees (field n), which REST order history does not carry.
// Holdings are still decided by REST reconciliation.

export interface AccountStreamStatus {
  connected: boolean;
  lastMessageAt: string | null;
  lastError: string | null;
  // Set on disconnect; buying is disabled until a reconnect and a REST reconcile clear it.
  stale: boolean;
}

export class AccountStream {
  readonly ledgers = new Map<string, FillLedger>();
  readonly status: AccountStreamStatus = { connected: false, lastMessageAt: null, lastError: null, stale: true };

  constructor(
    private readonly client: () => Promise<GeminiClient>,
    // Gemini's websocket accepts account-scoped keys only and answers master keys with 401.
    private readonly masterKey = false,
  ) {}

  async start(): Promise<void> {
    if (this.masterKey) {
      this.status.lastError = "master keys cannot open the account websocket; fees are booked from the published schedule";
      return;
    }
    try {
      const c = await this.client();
      const stream = c.websocket.private.orders({ scope: "account" });
      stream.on("message", (m) => this.onOrder(m as unknown as Record<string, unknown>));
      stream.on("error", (e) => {
        this.status.lastError = e.message;
        this.status.stale = true;
      });
      stream.on("close", () => {
        this.status.connected = false;
        this.status.stale = true;
      });
      stream.on("resubscribed", () => {
        this.status.connected = true;
        this.status.stale = false;
      });
      await stream.ready;
      this.status.connected = true;
      this.status.stale = false;
    } catch (e) {
      this.status.connected = false;
      this.status.stale = true;
      this.status.lastError = e instanceof Error ? e.message : String(e);
    }
  }

  private onOrder(m: Record<string, unknown>): void {
    this.status.lastMessageAt = new Date().toISOString();
    if (m.e !== "orderUpdate" || m.i == null) return;
    const orderId = idToString(m.i);
    const ledger = this.ledgers.get(orderId) ?? new FillLedger(orderId);
    this.ledgers.set(orderId, ledger);
    const ev: OrderStreamEvent = {
      orderId,
      status: String(m.X) as OrderStreamEvent["status"],
      executedQuantity: m.Z != null ? String(m.Z) : undefined,
      lastPrice: m.L != null ? String(m.L) : undefined,
      tradeId: m.t != null ? idToString(m.t) : undefined,
      fee: m.n != null ? String(m.n) : undefined,
      maker: typeof m.m === "boolean" ? m.m : undefined,
      reason: m.r != null ? String(m.r) : undefined,
      eventTimeNs: idToString(m.E ?? Date.now()),
    };
    ledger.apply(ev);
  }
}
