import { describe, expect, it } from "vitest";
import { operationalScenarios, promotionScenarios } from "./scenarios.js";
import { allocationIsSafe, rewardCapacity } from "./capacity.js";

describe("promotionScenarios", () => {
  const rows = promotionScenarios({ heldPayoutUnits: "800", costUsd: "333.44", rewardUsd: "20", claimedEntitlements: 12, maxEntitlements: 40 });

  it("nets payout against rewards when everything is claimed", () => {
    const full = rows.find((r) => r.id === "win_full")!;
    expect(full.netCostUsd).toBe("333.44");
  });

  it("calls out unallocated payout instead of counting it as savings", () => {
    const partial = rows.find((r) => r.id === "win_partial")!;
    expect(partial.obligationUsd).toBe("240.00");
    expect(partial.note).toContain("560.00");
  });
});

describe("operationalScenarios", () => {
  it("includes a loss without payout and a payout without loss", () => {
    const rows = operationalScenarios({ heldPayoutUnits: "1200", costUsd: "250", lostContributionUsd: "1800" });
    expect(rows.find((r) => r.id === "loss_without_payout")!.netCostUsd).toBe("2050.00");
    expect(rows.find((r) => r.id === "payout_without_loss")!.netCostUsd).toBe("-950.00");
  });
});

describe("capacity", () => {
  it("counts holds against capacity so the last slot cannot be double sold", () => {
    expect(rewardCapacity("120", "100", "0", "20")).toBe(1);
    expect(rewardCapacity("120", "100", "20", "20")).toBe(0);
  });

  it("flags an unsafe allocation", () => {
    expect(allocationIsSafe("120", "100", "20")).toBe(true);
    expect(allocationIsSafe("120", "120", "20")).toBe(false);
  });
});
