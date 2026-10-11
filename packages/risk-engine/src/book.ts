import type { BookLevel, DepthSnapshot, Outcome } from "@beagle/domain";
import { D, dec, type Dec, floorTo, ZERO } from "./decimal.js";

export interface PricedLevel {
  price: Dec;
  quantity: Dec;
}

// Gemini publishes one book per contract in YES price space.
//   Buying YES consumes YES asks, cheapest first.
//   Buying NO is selling YES from the other side: each resting YES bid at p is a NO ask at
//   1 - p with the same quantity. The best NO ask comes from the highest YES bid.
// Taking 1 - bestAsk as the NO price is wrong and is exactly the bug the PRD warns about.
export function executableAsks(depth: Pick<DepthSnapshot, "bids" | "asks">, outcome: Outcome): PricedLevel[] {
  const parse = (l: BookLevel): PricedLevel => ({ price: dec(l.price), quantity: dec(l.quantity) });
  if (outcome === "yes") {
    return depth.asks
      .map(parse)
      .filter((l) => l.quantity.gt(0))
      .sort((a, b) => a.price.comparedTo(b.price));
  }
  return depth.bids
    .map(parse)
    .filter((l) => l.quantity.gt(0))
    .map((l) => ({ price: D.sub(1, l.price), quantity: l.quantity }))
    .sort((a, b) => a.price.comparedTo(b.price));
}

export interface SimulatedFill {
  price: Dec;
  quantity: Dec;
}

export interface BookWalk {
  fills: SimulatedFill[];
  filledQuantity: Dec;
  principal: Dec;
  averagePrice: Dec | null;
  worstPrice: Dec | null;
  // Quantity available at or under the limit across observed levels.
  availableUnderLimit: Dec;
  levelsConsumed: number;
}

// Walk observed levels up to `limitPrice`. Never extrapolates past the supplied levels: if
// the book shows 14 contracts under the limit, 14 is the most this returns.
export function walkBook(asks: PricedLevel[], quantity: Dec, limitPrice: Dec, quantityIncrement: Dec): BookWalk {
  const eligible = asks.filter((l) => l.price.lte(limitPrice));
  const availableUnderLimit = floorTo(
    eligible.reduce((s, l) => s.plus(l.quantity), ZERO),
    quantityIncrement,
  );
  const fills: SimulatedFill[] = [];
  let remaining = floorTo(quantity, quantityIncrement);
  for (const level of eligible) {
    if (remaining.lte(0)) break;
    const take = floorTo(D.min(level.quantity, remaining), quantityIncrement);
    if (take.lte(0)) continue;
    fills.push({ price: level.price, quantity: take });
    remaining = remaining.minus(take);
  }
  const filledQuantity = fills.reduce((s, f) => s.plus(f.quantity), ZERO);
  const principal = fills.reduce((s, f) => s.plus(f.quantity.mul(f.price)), ZERO);
  return {
    fills,
    filledQuantity,
    principal,
    averagePrice: filledQuantity.gt(0) ? principal.div(filledQuantity) : null,
    worstPrice: fills.length ? fills[fills.length - 1]!.price : null,
    availableUnderLimit,
    levelsConsumed: fills.length,
  };
}
