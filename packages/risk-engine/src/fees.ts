import { CENT, ceilTo, D, dec, type Dec, ZERO } from "./decimal.js";

// Gemini Predictions fee schedule (https://www.gemini.com/fees/predictions).
// Taker fee per fill = coefficient * q * p * (1 - p), rounded up to the cent.
// The schedule is data passed in, not a constant, so a maker waiver or a schedule change
// never silently becomes a permanent assumption.
export interface FeeSchedule {
  takerCoefficient: string;
  makerCoefficient: string;
  roundingUnit: string;
  source: string;
}

export const PUBLISHED_FEE_SCHEDULE: FeeSchedule = {
  takerCoefficient: "0.07",
  makerCoefficient: "0.0175",
  roundingUnit: "0.01",
  source: "https://www.gemini.com/fees/predictions",
};

export function fillFee(quantity: Dec, price: Dec, schedule: FeeSchedule, role: "taker" | "maker" = "taker"): Dec {
  const coef = dec(role === "taker" ? schedule.takerCoefficient : schedule.makerCoefficient);
  const raw = coef.mul(quantity).mul(price).mul(D.sub(1, price));
  if (raw.isZero()) return ZERO;
  return ceilTo(raw, dec(schedule.roundingUnit));
}

// p * (1 - p) is maximized at 0.5. Over a price interval [lo, hi] the max is at the point
// closest to 0.5.
export function maxVariance(lo: Dec, hi: Dec): Dec {
  const half = dec("0.5");
  const p = hi.lt(half) ? hi : lo.gt(half) ? lo : half;
  return p.mul(D.sub(1, p));
}

export interface FeeCeiling {
  ceilingUsd: Dec;
  assumedFillUnit: Dec;
  maxFills: number;
  perFillCeiling: Dec;
  formulaFeeAtWorstPrice: Dec;
}

// Conservative upper bound on total taker fees for buying `quantity` at prices no worse than
// `limitPrice`, assuming no fill is smaller than `fillUnit`.
//
// Each fill's fee is rounded up independently, so the bound is
//   sum_i ceil(c * q_i * v_i) <= sum_i (c * q_i * vmax + unit) = c * Q * vmax + N * unit
// and we take the tighter of that and N * ceil(c * fillUnit * vmax) when fills are all
// exactly one unit. N = ceil(Q / fillUnit).
//
// The bound is only as true as fillUnit. The plan shows that assumption to the merchant and
// reconciliation compares real fees against the reservation.
export function takerFeeCeiling(
  quantity: Dec,
  priceMin: Dec,
  limitPrice: Dec,
  fillUnit: Dec,
  schedule: FeeSchedule,
): FeeCeiling {
  if (quantity.lte(0)) {
    return { ceilingUsd: ZERO, assumedFillUnit: fillUnit, maxFills: 0, perFillCeiling: ZERO, formulaFeeAtWorstPrice: ZERO };
  }
  const coef = dec(schedule.takerCoefficient);
  const unit = dec(schedule.roundingUnit);
  const vmax = maxVariance(priceMin, limitPrice);
  const maxFills = quantity.div(fillUnit).toDecimalPlaces(0, D.ROUND_CEIL).toNumber();
  const perFillCeiling = ceilTo(coef.mul(fillUnit).mul(vmax), unit);
  const linear = coef.mul(quantity).mul(vmax).plus(unit.mul(maxFills));
  const allUnitFills = perFillCeiling.mul(maxFills);
  const ceilingUsd = ceilTo(D.min(linear, allUnitFills), CENT);
  return {
    ceilingUsd,
    assumedFillUnit: fillUnit,
    maxFills,
    perFillCeiling,
    formulaFeeAtWorstPrice: ceilTo(coef.mul(quantity).mul(vmax), unit),
  };
}
