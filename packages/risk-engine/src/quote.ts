import type { DepthSnapshot, Outcome } from "@riskpilot/domain";
import { CENT, ceilTo, D, dec, type Dec, floorTo, fmtOnGrid, usd, ZERO } from "./decimal.js";
import { executableAsks, walkBook, type BookWalk } from "./book.js";
import { type FeeSchedule, fillFee, takerFeeCeiling, type FeeCeiling } from "./fees.js";

export interface InstrumentGrid {
  quantityIncrement: string;
  quantityMinimum: string;
  priceIncrement: string;
  priceMinimum: string;
}

export interface QuoteInput {
  depth: DepthSnapshot;
  outcome: Outcome;
  grid: InstrumentGrid;
  fees: FeeSchedule;
  // The merchant's price ceiling. The limit price sent to the exchange never exceeds it.
  priceCeiling: string;
  // Hard maximum debit including the fee ceiling.
  budgetUsd: string;
  // Fee ceiling assumes no fill smaller than this. Shown to the merchant as an assumption.
  feeBoundFillUnit: string;
  now: Date;
}

export type LimitingFactor = "requested" | "depth" | "budget" | "price_ceiling";

export interface Quote {
  outcome: Outcome;
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
  limitingFactor: LimitingFactor;
  feeAssumption: { fillUnit: string; maxFills: number; perFillCeiling: string };
  observedAt: string;
  quotedAt: string;
  simulatedFills: { price: string; quantity: string; fee: string }[];
}

export interface Sized {
  quote: Quote | null;
  reason: LimitingFactor | "no_depth" | "below_minimum";
}

function estimate(walk: BookWalk, fees: FeeSchedule): { fees: Dec; perFill: { price: Dec; quantity: Dec; fee: Dec }[] } {
  const perFill = walk.fills.map((f) => ({ ...f, fee: fillFee(f.quantity, f.price, fees, "taker") }));
  return { fees: perFill.reduce((s, f) => s.plus(f.fee), ZERO), perFill };
}

// Choose the limit price actually sent: the worst observed level we need, never above the
// merchant ceiling, snapped to the instrument's price grid.
function limitFor(walk: BookWalk, ceiling: Dec, grid: InstrumentGrid): Dec {
  const inc = dec(grid.priceIncrement);
  const worst = walk.worstPrice ?? ceiling;
  return D.min(ceilTo(worst, inc), floorTo(ceiling, inc));
}

function maxDebit(quantity: Dec, limit: Dec, input: QuoteInput): { principal: Dec; ceiling: FeeCeiling; total: Dec } {
  const principal = quantity.mul(limit);
  const ceiling = takerFeeCeiling(quantity, dec(input.grid.priceMinimum), limit, dec(input.feeBoundFillUnit), input.fees);
  return { principal, ceiling, total: ceilTo(principal.plus(ceiling.ceilingUsd), CENT) };
}

// Largest quantity <= `requested` whose conservative max debit fits the budget and which
// the observed book can fill at or under the ceiling. `step` lets the promotion sizer move
// in whole-reward units (e.g. 20 contracts per $20 reward).
export function sizeToBudget(input: QuoteInput, requested: Dec, step: Dec): Sized {
  const asks = executableAsks(input.depth, input.outcome);
  const ceiling = dec(input.priceCeiling);
  const qInc = dec(input.grid.quantityIncrement);
  const qMin = dec(input.grid.quantityMinimum);
  const budget = dec(input.budgetUsd);

  const probe = walkBook(asks, requested, ceiling, qInc);
  if (probe.availableUnderLimit.lte(0)) return { quote: null, reason: "no_depth" };

  let limiting: LimitingFactor = "requested";
  let q = floorTo(requested, step);
  if (probe.availableUnderLimit.lt(q)) {
    q = floorTo(probe.availableUnderLimit, step);
    limiting = "depth";
  }

  // Shrink by `step` until the conservative max debit fits. Monotone, so this terminates.
  while (q.gt(0)) {
    const walk = walkBook(asks, q, ceiling, qInc);
    const limit = limitFor(walk, ceiling, input.grid);
    if (maxDebit(q, limit, input).total.lte(budget)) break;
    q = q.minus(step);
    limiting = "budget";
  }
  if (q.lt(qMin) || q.lte(0)) return { quote: null, reason: limiting === "budget" ? "budget" : "below_minimum" };

  const walk = walkBook(asks, q, ceiling, qInc);
  const limit = limitFor(walk, ceiling, input.grid);
  const est = estimate(walk, input.fees);
  const bound = maxDebit(q, limit, input);

  return {
    reason: limiting,
    quote: {
      outcome: input.outcome,
      quantity: fmtOnGrid(q, qInc),
      limitPrice: fmtOnGrid(limit, dec(input.grid.priceIncrement)),
      estimatedPrincipalUsd: usd(walk.principal),
      estimatedFeesUsd: usd(est.fees),
      estimatedDebitUsd: usd(walk.principal.plus(est.fees)),
      maxPrincipalUsd: usd(bound.principal),
      feeCeilingUsd: usd(bound.ceiling.ceilingUsd),
      maxDebitUsd: usd(bound.total),
      averagePrice: walk.averagePrice ? walk.averagePrice.toDecimalPlaces(4).toString() : null,
      availableUnderLimit: probe.availableUnderLimit.toString(),
      levelsConsumed: walk.levelsConsumed,
      limitingFactor: limiting,
      feeAssumption: {
        fillUnit: input.feeBoundFillUnit,
        maxFills: bound.ceiling.maxFills,
        perFillCeiling: usd(bound.ceiling.perFillCeiling),
      },
      observedAt: input.depth.observedAt,
      quotedAt: input.now.toISOString(),
      simulatedFills: est.perFill.map((f) => ({ price: f.price.toString(), quantity: f.quantity.toString(), fee: usd(f.fee) })),
    },
  };
}

// Promotion sizing (PRD section 13): a $1-paying contract and a fixed reward r means each
// entitlement needs r payout units. Capacity is whole rewards only.
export function quotePromotion(
  input: QuoteInput,
  rewardUsd: string,
  maxEntitlements: number,
): Sized & { entitlements: number } {
  const r = dec(rewardUsd);
  const step = ceilTo(r, dec(input.grid.quantityIncrement));
  const sized = sizeToBudget(input, step.mul(maxEntitlements), step);
  const entitlements = sized.quote ? dec(sized.quote.quantity).div(step).floor().toNumber() : 0;
  return { ...sized, entitlements };
}

// Operational sizing: hedge up to the merchant's lost contribution, not booked revenue.
export function quoteOperational(input: QuoteInput, lostContributionUsd: string): Sized {
  return sizeToBudget(input, dec(lostContributionUsd), dec(input.grid.quantityIncrement));
}

export function quoteAgeMs(quote: Pick<Quote, "observedAt">, now: Date): number {
  return now.getTime() - new Date(quote.observedAt).getTime();
}

export function isQuoteFresh(quote: Pick<Quote, "observedAt">, now: Date, maxAgeMs: number): boolean {
  const age = quoteAgeMs(quote, now);
  return age >= 0 && age <= maxAgeMs;
}
