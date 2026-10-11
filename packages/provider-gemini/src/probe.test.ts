import { describe, expect, it } from "vitest";
import { createPublicClient } from "./client.js";
import { discoverInventory, fetchDepth } from "./inventory.js";

// Live read-only checks against Gemini's public endpoints. Skipped unless LIVE_GEMINI=1 so CI
// never depends on exchange inventory.
describe.skipIf(!process.env.LIVE_GEMINI)("live public inventory", () => {
  it("finds sandbox crypto contracts with a real depth snapshot", async () => {
    const c = await createPublicClient("sandbox");
    const inv = await discoverInventory(c, "sandbox", { categories: ["Crypto"], search: "BTC", maxEvents: 20 });
    expect(inv.candidates.length).toBeGreaterThan(0);
    const d = await fetchDepth(c, "sandbox", inv.candidates[0]!.instrumentSymbol);
    expect(d.instrumentSymbol).toBe(inv.candidates[0]!.instrumentSymbol);
  }, 60_000);

  it("reports Sports as missing from sandbox", async () => {
    const c = await createPublicClient("sandbox");
    const inv = await discoverInventory(c, "sandbox", { categories: ["Sports"] });
    // Census on 2026-10-11 found zero sandbox sports events. If this starts failing the
    // sandbox has listed sports and ADR 0001 can be revisited.
    expect(inv.categoriesMissing).toEqual(["Sports"]);
  }, 60_000);
});
