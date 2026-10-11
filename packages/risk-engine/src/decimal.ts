import { Decimal } from "decimal.js";

// One configured Decimal constructor for the whole engine. 40 significant digits is far
// beyond any cent amount we handle, and ROUND_HALF_EVEN is only the default; every money
// rounding below names its direction explicitly.
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });
export type Dec = InstanceType<typeof D>;

export const ZERO = new D(0);
export const ONE = new D(1);
export const CENT = new D("0.01");

export const dec = (v: string | number | Dec): Dec => new D(v);

export function ceilTo(value: Dec, unit: Dec): Dec {
  return value.div(unit).toDecimalPlaces(0, D.ROUND_CEIL).mul(unit);
}

export function floorTo(value: Dec, unit: Dec): Dec {
  return value.div(unit).toDecimalPlaces(0, D.ROUND_FLOOR).mul(unit);
}

export const usd = (v: Dec): string => v.toDecimalPlaces(2, D.ROUND_HALF_EVEN).toFixed(2);

// Render a quantity or price with exactly the precision of its increment.
export function fmtOnGrid(v: Dec, increment: Dec): string {
  return v.toFixed(Math.max(0, increment.decimalPlaces()));
}

export function isOnGrid(value: Dec, increment: Dec, anchor: Dec = ZERO): boolean {
  return value.minus(anchor).mod(increment).isZero();
}
