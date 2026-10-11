import { z } from "zod";
import { DecimalString } from "./money.js";

export const ExchangeEnvironment = z.enum(["sandbox", "production"]);
export type ExchangeEnvironment = z.infer<typeof ExchangeEnvironment>;

export const Outcome = z.enum(["yes", "no"]);
export type Outcome = z.infer<typeof Outcome>;

export const StrikeType = z.enum([
  "reference",
  "above",
  "below",
  "spread",
  "over",
  "over_or_equal",
  "under",
  "under_or_equal",
]);
export type StrikeType = z.infer<typeof StrikeType>;

// One tradable contract normalized from a Gemini event. Everything the matcher and the
// executor need is here so neither has to reread the raw provider payload.
export const MarketCandidate = z.object({
  environment: ExchangeEnvironment,
  category: z.string(),
  subcategoryPath: z.array(z.string()),
  eventTicker: z.string(),
  eventTitle: z.string(),
  eventStatus: z.string(),
  instrumentSymbol: z.string(),
  contractTicker: z.string(),
  label: z.string(),
  contractStatus: z.string(),
  marketState: z.enum(["open", "closed"]).nullable(),
  strike: z
    .object({ type: StrikeType.nullable(), value: DecimalString.nullable() })
    .nullable(),
  effectiveDate: z.string().nullable(),
  expiryDate: z.string().nullable(),
  startTime: z.string().nullable(),
  participants: z.array(z.object({ name: z.string(), abbreviation: z.string().nullable(), side: z.string().nullable() })),
  settlementSource: z.string().nullable(),
  rulesText: z.string(),
  termsUrl: z.string().nullable(),
  rulesHash: z.string(),
  quantityIncrement: DecimalString,
  quantityMinimum: DecimalString,
  priceIncrement: DecimalString,
  priceMinimum: DecimalString,
  indicativeBuyYes: DecimalString.nullable(),
  indicativeBuyNo: DecimalString.nullable(),
});
export type MarketCandidate = z.infer<typeof MarketCandidate>;

// Book levels in YES price space, as Gemini publishes them.
export const BookLevel = z.object({ price: DecimalString, quantity: DecimalString });
export type BookLevel = z.infer<typeof BookLevel>;

export const DepthSnapshot = z.object({
  instrumentSymbol: z.string(),
  environment: ExchangeEnvironment,
  bids: z.array(BookLevel),
  asks: z.array(BookLevel),
  observedAt: z.string().datetime(),
  lastUpdateId: z.string().nullable(),
});
export type DepthSnapshot = z.infer<typeof DepthSnapshot>;
