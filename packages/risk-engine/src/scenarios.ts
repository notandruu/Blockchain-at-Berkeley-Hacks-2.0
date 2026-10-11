import { dec, type Dec, usd, ZERO } from "./decimal.js";

// PRD section 13: financial result under scenario s is L(s) + C - P(s).
// L = merchant loss or reward obligation, C = acquisition cost plus fees, P = contract payout.
// Positive result = net cost to the merchant. Payout is never labelled profit.

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

function row(id: string, label: string, eventOccurs: boolean, L: Dec, C: Dec, P: Dec, note: string): ScenarioRow {
  return {
    id,
    label,
    eventOccurs,
    obligationUsd: usd(L),
    costUsd: usd(C),
    payoutUsd: usd(P),
    netCostUsd: usd(L.plus(C).minus(P)),
    note,
  };
}

export interface PromotionScenarioInput {
  heldPayoutUnits: string;
  costUsd: string;
  rewardUsd: string;
  claimedEntitlements: number;
  maxEntitlements: number;
}

export function promotionScenarios(i: PromotionScenarioInput): ScenarioRow[] {
  const units = dec(i.heldPayoutUnits);
  const C = dec(i.costUsd);
  const r = dec(i.rewardUsd);
  const full = r.mul(i.maxEntitlements);
  const claimed = r.mul(i.claimedEntitlements);
  const unused = units.minus(claimed);
  return [
    row("win_full", `Event happens, all ${i.maxEntitlements} rewards claimed`, true, full, C, units,
      "Payout offsets the rewards owed. Net cost is what the coverage cost."),
    row("win_partial", `Event happens, ${i.claimedEntitlements} rewards claimed`, true, claimed, C, units,
      unused.gt(0) ? `$${usd(unused)} of payout is not tied to any reward. It is a separate position, not a promotion saving.` : "All payout is allocated to rewards."),
    row("lose", "Event does not happen", false, ZERO, C, ZERO,
      "No rewards owed and no payout. The coverage cost is the promotion's marketing expense."),
  ];
}

export interface OperationalScenarioInput {
  heldPayoutUnits: string;
  costUsd: string;
  lostContributionUsd: string;
}

// Shows basis risk explicitly: a loss with no payout and a payout with no loss.
export function operationalScenarios(i: OperationalScenarioInput): ScenarioRow[] {
  const P = dec(i.heldPayoutUnits);
  const C = dec(i.costUsd);
  const L = dec(i.lostContributionUsd);
  return [
    row("trigger_and_loss", "Contract pays and the job is lost", true, L, C, P, "The intended case. Payout offsets part or all of the lost contribution."),
    row("loss_without_payout", "Job is lost but the contract does not pay", false, L, C, ZERO,
      "Basis risk. Conditions at the job site differ from the settlement station, or the loss had another cause."),
    row("payout_without_loss", "Contract pays but the job goes ahead", true, ZERO, C, P,
      "Payout with no loss. Do not count this as protection you can rely on."),
    row("neither", "No trigger and no loss", false, ZERO, C, ZERO, "Cost of carrying the hedge."),
  ];
}
