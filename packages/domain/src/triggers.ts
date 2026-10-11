import { z } from "zod";
import { DecimalString } from "./money.js";

// The PRD replaces RiskSpec.trigger: Record<string, unknown> with a discriminated union.
// Each variant lists exactly the fields the contract matcher compares. A field the merchant
// did not supply stays null and turns into a missing-input question, never a guess.

export const ComparisonOperator = z.enum(["gt", "gte", "lt", "lte", "between"]);
export type ComparisonOperator = z.infer<typeof ComparisonOperator>;

export const SportsResultTrigger = z.object({
  kind: z.literal("sports_result"),
  league: z.string().min(1),
  homeTeam: z.string().min(1),
  awayTeam: z.string().min(1),
  team: z.string().min(1),
  gameDate: z.string().date(),
  scheduledStart: z.string().datetime().nullable(),
  // "regulation" means a tie after regulation does not pay; "final" includes overtime.
  period: z.enum(["final", "regulation"]),
  // How the merchant's promise treats a tie. Compared against the contract's own rule.
  tieTreatment: z.enum(["no_reward", "reward", "unspecified"]),
  cancellationTreatment: z.enum(["void_promotion", "unspecified"]),
});

export const TemperatureTrigger = z.object({
  kind: z.literal("temperature"),
  // The official observation point, for example "NWS Climatological Report (Daily) for San Francisco, CA".
  station: z.string().min(1),
  city: z.string().min(1),
  metric: z.enum(["daily_high", "daily_low"]),
  unit: z.enum(["F", "C"]),
  operator: ComparisonOperator,
  threshold: DecimalString,
  thresholdUpper: DecimalString.nullable(),
  observationDate: z.string().date(),
  timezone: z.string().min(1),
  source: z.string().min(1),
});

// Crypto and commodity contracts ("BTC price on October 16, above $80,500").
// Added in ADR 0001 because the sandbox lists only these categories.
export const PriceThresholdTrigger = z.object({
  kind: z.literal("price_threshold"),
  asset: z.string().min(1),
  operator: ComparisonOperator,
  threshold: DecimalString,
  thresholdUpper: DecimalString.nullable(),
  observationTime: z.string().datetime(),
  // Index the contract settles against, for example LS-LRRR-XBTUSD. Null until verified.
  settlementIndex: z.string().nullable(),
});

export const PolicyEventTrigger = z.object({
  kind: z.literal("policy_event"),
  action: z.string().min(1),
  authority: z.string().min(1),
  effectiveBy: z.string().date(),
});

export const Trigger = z.discriminatedUnion("kind", [
  SportsResultTrigger,
  TemperatureTrigger,
  PriceThresholdTrigger,
  PolicyEventTrigger,
]);
export type Trigger = z.infer<typeof Trigger>;
export type TriggerKind = Trigger["kind"];

// Trigger kinds that have an implemented verifier in the risk engine. A kind outside this
// list can be researched but never executed (PRD section 22).
export const EXECUTABLE_TRIGGER_KINDS: readonly TriggerKind[] = [
  "sports_result",
  "temperature",
  "price_threshold",
];
