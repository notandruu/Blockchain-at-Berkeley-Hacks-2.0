import { createHash } from "node:crypto";
import { z } from "zod";
import { DecimalString, NonNegativeDecimal } from "./money.js";
import { Outcome } from "./market.js";

export const MatchType = z.enum(["exact", "proxy", "rejected", "unknown"]);
export type MatchType = z.infer<typeof MatchType>;

export const TradePlan = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  riskId: z.string(),
  environment: z.literal("sandbox"),
  instrumentSymbol: z.string(),
  eventTicker: z.string(),
  outcome: Outcome,
  quantity: NonNegativeDecimal,
  limitPrice: DecimalString,
  estimatedDebitUsd: NonNegativeDecimal,
  maxDebitUsd: NonNegativeDecimal,
  matchType: MatchType,
  quoteId: z.string(),
  rulesHash: z.string(),
  timeInForce: z.enum(["fill-or-kill", "immediate-or-cancel"]),
  // Only meaningful for immediate-or-cancel. Partial coverage below this is treated as no fill.
  minAcceptableQuantity: NonNegativeDecimal,
  campaign: z
    .object({
      rewardPerEntitlementUsd: NonNegativeDecimal,
      maxEntitlements: z.number().int().nonnegative(),
      headline: z.string(),
      qualification: z.string(),
      enrollmentClosesAt: z.string().datetime(),
    })
    .nullable(),
  expiresAt: z.string().datetime(),
});
export type TradePlan = z.infer<typeof TradePlan>;

// Stable JSON: sorted keys, no whitespace. Two plans with the same fields always hash the
// same regardless of property insertion order.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// An approval binds to this hash. Any edit to the plan produces a new version with a new
// hash, so an old approval cannot authorize it (PRD section 14).
export function planHash(plan: TradePlan): string {
  return sha256(canonicalJson(plan));
}
