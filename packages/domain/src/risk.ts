import { z } from "zod";
import { DecimalString, NonNegativeDecimal } from "./money.js";
import { Trigger } from "./triggers.js";

export const RiskMode = z.enum(["promotion", "operational"]);

// Operational exposures separate booked revenue from what is actually lost. $3,000 of
// booked revenue is not $3,000 of economic loss (PRD section 2).
export const OperationalExposure = z.object({
  bookedRevenueUsd: NonNegativeDecimal,
  avoidedCostsUsd: NonNegativeDecimal,
  unavoidableCostsUsd: NonNegativeDecimal,
  notes: z.string().default(""),
});

export const PromotionTerms = z.object({
  rewardPerEntitlementUsd: NonNegativeDecimal,
  maxEntitlements: z.number().int().positive(),
  qualification: z.string(),
  enrollmentClosesAt: z.string().datetime(),
});

export const RiskSpec = z.object({
  id: z.string(),
  merchantId: z.string(),
  mode: RiskMode,
  title: z.string(),
  exposureUsd: NonNegativeDecimal,
  exposureBasis: z.string(),
  trigger: Trigger,
  eventWindow: z.object({
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    timezone: z.string(),
  }),
  budgetUsd: NonNegativeDecimal,
  priceCeiling: DecimalString.nullable(),
  promotion: PromotionTerms.nullable(),
  operational: OperationalExposure.nullable(),
  evidenceIds: z.array(z.string()),
});
export type RiskSpec = z.infer<typeof RiskSpec>;

// Fields the agent must ask for instead of inventing. Used to render the inline
// missing-input card.
export const MissingInput = z.object({
  field: z.string(),
  question: z.string(),
  why: z.string(),
});
export type MissingInput = z.infer<typeof MissingInput>;
