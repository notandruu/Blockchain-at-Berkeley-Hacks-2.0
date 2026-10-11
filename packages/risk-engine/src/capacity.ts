import { dec, ZERO } from "./decimal.js";

// Capacity is the integer number of rewards supported by confirmed, unallocated payout
// units (PRD section 13). Pending holds count as used so two claims cannot race the
// last slot.
export function rewardCapacity(confirmedUnits: string, allocatedUnits: string, pendingHoldUnits: string, rewardUsd: string): number {
  const free = dec(confirmedUnits).minus(dec(allocatedUnits)).minus(dec(pendingHoldUnits));
  if (free.lte(ZERO)) return 0;
  return free.div(dec(rewardUsd)).floor().toNumber();
}

// Invariant 3: committed reward units plus holds never exceed confirmed holdings.
export function allocationIsSafe(confirmedUnits: string, allocatedUnits: string, pendingHoldUnits: string): boolean {
  return dec(allocatedUnits).plus(dec(pendingHoldUnits)).lte(dec(confirmedUnits));
}
