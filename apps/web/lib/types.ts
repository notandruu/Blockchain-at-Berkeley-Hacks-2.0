// Shapes returned by the service. Kept local so the web bundle does not depend on server
// packages; field names match apps/service/src/http/views.ts.

export type RunStateName =
  | "DRAFT" | "NEEDS_INPUT" | "RESEARCHING" | "MATCHING" | "QUOTING" | "AWAITING_APPROVAL" | "NO_EXECUTABLE_MATCH"
  | "APPROVED" | "SUBMITTING" | "RECONCILING" | "ACTIVE" | "NO_FILL" | "EXECUTION_UNKNOWN" | "MONITORING" | "PAUSED"
  | "SETTLEMENT_PENDING" | "SETTLEMENT_EXCEPTION" | "RECONCILED" | "FAILED";

export interface RunEvent {
  id: string;
  runId: string;
  sequence: number;
  timestamp: string;
  type: string;
  provider: "context" | "gemini_markets" | "risk_engine" | "app" | "agent";
  mode: "live_research" | "sandbox_exchange" | "simulation" | "recorded";
  title: string;
  artifactId?: string | null;
  sourceUrl?: string | null;
  providerRequestId?: string | null;
  payload: Record<string, any>;
}

export interface FieldCheck {
  field: string;
  merchant: string;
  contract: string;
  status: "match" | "mismatch" | "partial" | "unknown";
  note?: string;
}

export interface Quote {
  outcome: "yes" | "no";
  quantity: string;
  limitPrice: string;
  estimatedPrincipalUsd: string;
  estimatedFeesUsd: string;
  estimatedDebitUsd: string;
  maxPrincipalUsd: string;
  feeCeilingUsd: string;
  maxDebitUsd: string;
  averagePrice: string | null;
  availableUnderLimit: string;
  levelsConsumed: number;
  limitingFactor: "requested" | "depth" | "budget" | "price_ceiling";
  feeAssumption: { fillUnit: string; maxFills: number; perFillCeiling: string };
  observedAt: string;
  simulatedFills: { price: string; quantity: string; fee: string }[];
}

export interface TradePlan {
  id: string;
  version: number;
  instrumentSymbol: string;
  eventTicker: string;
  outcome: "yes" | "no";
  quantity: string;
  limitPrice: string;
  estimatedDebitUsd: string;
  maxDebitUsd: string;
  matchType: "exact" | "proxy" | "rejected" | "unknown";
  timeInForce: string;
  rulesHash: string;
  campaign: { rewardPerEntitlementUsd: string; maxEntitlements: number; headline: string; qualification: string; enrollmentClosesAt: string } | null;
  expiresAt: string;
}

export interface ScenarioRow {
  id: string;
  label: string;
  eventOccurs: boolean;
  obligationUsd: string;
  costUsd: string;
  payoutUsd: string;
  netCostUsd: string;
  note: string;
}

export interface PlanPresentation {
  eventTitle: string;
  contractLabel: string;
  termsUrl: string | null;
  settlementSource: string | null;
  expiryDate: string | null;
  checks: FieldCheck[];
  caveats: string[];
  entitlements: number;
  requestedEntitlements: number | null;
  limitingFactor: Quote["limitingFactor"];
  feeAssumption: Quote["feeAssumption"];
  quote: Quote;
  scenarios: ScenarioRow[];
  venueName: string | null;
}

export interface PlanRow {
  id: string;
  version: number;
  status: string;
  body: { plan: TradePlan; presentation: PlanPresentation };
  plan_hash: string;
  max_debit_usd: string;
  expires_at: string;
  last_quote_check: QuoteCheck | null;
}

export interface QuoteCheck {
  fillable: boolean;
  observedAt: string;
  rulesHashMatches: boolean;
  marketOpen: boolean;
  availableUnderLimit: string;
  estimatedDebitUsd: string | null;
  reason: string;
  accountStreamStale?: boolean;
  quoteMaxAgeMs?: number;
}

export interface SourceRow {
  id: string;
  requested_url: string;
  final_url: string;
  domain: string;
  title: string | null;
  objective: string;
  capture_status: "screenshot" | "text_only" | "failed";
  screenshot_artifact_id: string | null;
  screenshotUrl: string | null;
  context_request_id: string | null;
  cache_status: string | null;
  cache_age_ms: number | null;
  retrieved_at: string;
  excerpt: string | null;
}

export interface OrderRow {
  id: string;
  state: string;
  symbol: string;
  outcome: string;
  quantity: string;
  limit_price: string;
  exchange_order_id: string | null;
  exchange_status: string | null;
  filled_quantity: string;
  avg_price: string | null;
  principal_usd: string;
  fees_usd: string;
  fees_source: string | null;
  submitted_at: string | null;
  reconciled_at: string | null;
  reject_code: string | null;
  reserved_usd: string | null;
  spent_usd: string | null;
  reservation_status: string | null;
}

export interface CampaignRow {
  id: string;
  slug: string;
  public_token: string;
  venue_name: string;
  headline: string;
  qualification: string;
  reward_usd: string;
  max_entitlements: number;
  status: string;
  closes_at: string;
  confirmed_units: string | null;
  allocated_units: string | null;
  claimed: number;
}

export interface RunView {
  run: {
    id: string;
    goal: string;
    business_url: string | null;
    inputs: { budgetUsd?: string | null };
    state: RunStateName;
    mode: "live" | "recorded";
    research_credits_used: number;
    research_credit_ceiling: number;
    error_code: string | null;
    error_message: string | null;
    created_at: string;
  };
  sources: SourceRow[];
  evidence: { id: string; source_id: string | null; provenance: "source" | "merchant" | "inference"; claim: string; passage: string | null }[];
  matches: { instrument_symbol: string; environment: string; label: string; match_type: string; executable: boolean; outcome: string | null; checks: FieldCheck[]; rejections: string[]; caveats: string[]; event_title: string }[];
  plans: PlanRow[];
  orders: OrderRow[];
  campaigns: CampaignRow[];
  providerCalls: { provider: string; operation: string; n: number; credits: string; avg_ms: number }[];
}
