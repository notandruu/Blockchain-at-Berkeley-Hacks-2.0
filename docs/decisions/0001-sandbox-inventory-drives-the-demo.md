# 0001: sandbox inventory drives which risk is executable

Date: 2026-10-11
Status: accepted

## Context

The PRD's primary demo is a sports bar promising $20 back if the home team wins. It also
says a production quote can never stand in for a sandbox fill, and that a missing market
must render as "No executable match".

We paginated the public events endpoint in both environments before writing any code.
Snapshot in `fixtures/gemini/inventory-census-2026-10-11.json`:

| environment | active events | sports | weather | crypto | commodities |
|---|---|---|---|---|---|
| sandbox (`api.sandbox.gemini.com`) | 94 | 0 | 0 | 76 | 18 |
| production (`api.gemini.com`) | 962 | 511 | 98 | 91 | 18 |

Sandbox depth is also thin. A `depthSnapshot` on `GEMI-XRP2610112300-HI1D40` returned
asks of 7, 7, 14, 14, 29, 29 contracts. Nowhere near the PRD fixture's 800 units.

## Decision

1. Market discovery reads both environments. Every candidate carries the environment it was
   found in. Only `sandbox` candidates can become an executable plan. Production candidates
   can be matched, compared and explained, and they end at `NOT_EXECUTABLE_IN_ENV`.
2. The executable bar promotion is tied to a sandbox crypto contract ("if BTC settles above
   the strike, $20 back on your tab"). The same pipeline runs the sports version against the
   real production NFL listing and stops honestly.
3. The contractor workflow matches against production NWS daily-high contracts, which name
   the exact station report. Station or date mismatch is a rejection reason, same as the PRD.
4. Quantity is capped by observed depth inside the price ceiling. If depth covers fewer
   rewards than requested, the plan says so and the campaign publishes fewer slots.

Nothing here is a hardcoded symbol. The preflight script picks the instrument from live
inventory at run time, and the census fixture is only test data.

## Consequences

If sandbox lists sports later, the sports flow becomes executable with no code change, because
eligibility is a function of the candidate's environment and its live depth.
