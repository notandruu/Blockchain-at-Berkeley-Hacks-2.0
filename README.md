# Beagle

An agent that researches a business risk, finds a prediction market contract that pays on the same event, explains what it does and does not cover, and buys the hedge on Gemini's sandbox after one explicit approval.

Built for Blockchain at Berkeley Hacks 2.0, Gemini Predictions API track and the Context.dev bonus.

The demo: a bar wants to tell customers "if Bitcoin is above $83,200 at 8pm, $20 back on your tab" without taking on unlimited exposure. Beagle reads the bar's site through Context.dev, scans Gemini inventory in sandbox and production, rejects the 49ers game because sandbox has no sports listings, sizes a hedge against the live sandbox book, and after approval buys it with a fill-or-kill order. The campaign then publishes exactly as many test rewards as the confirmed fill can pay. A second workflow, a painting crew worried about heat, runs through the same engine and ends with an honest "this contract settles at SFO airport, not your job site".

## What is real

- Every Context.dev search and scrape is a live request. Screenshots are decoded server side, checked against their magic bytes and stored in a private bucket.
- Market discovery, depth and orders hit Gemini. Discovery reads sandbox and production; only sandbox can be bought, and the service refuses to start otherwise.
- Quotes are built from observed book levels and never extrapolate. On 2026-10-11 a scan of all 304 sandbox contracts found depth on 38; the engine sizes to that.
- Holdings come from Gemini's order history and positions, not from the submit response.
- Customer claims are test entitlements. No real money, alcohol offer or insurance is involved.

Nothing in the flow is a hardcoded symbol, price or ticker. `fixtures/` holds captured API payloads for tests only.

## Run it

Prerequisites: Node 22.4+, pnpm 10, Docker, the Supabase CLI.

```bash
pnpm install
supabase start                      # local Postgres, Auth, Storage on ports 553xx
cp .env.example .env                # then fill in the provider keys
pnpm --filter @beagle/service seed
pnpm --filter @beagle/service dev
pnpm --filter @beagle/web dev    # http://localhost:3100
```

Keys you need in `.env`: `CONTEXT_DEV_API_KEY`, a Gemini **sandbox** `GEMINI_API_KEY` / `GEMINI_API_SECRET`, `ANTHROPIC_API_KEY` and `AGENT_MODEL`. The Supabase values come from `supabase start`.

Before a demo, check what the sandbox can actually fill right now:

```bash
pnpm preflight -- --reward 20 --entitlements 10 --budget 350 --ceiling 0.65 --min-hours 0.25
```

Real output from 2026-10-11 23:16 UTC (no account keys yet, so the account step was skipped):

```
▸ sandbox inventory
{ "eventsScanned": 94, "contractsByCategory": { "Crypto": 208 }, "categoriesWithNoEvents": ["Sports", "Weather"] }

▸ quotable strikes (observed depth, published fees)
  "symbol": "GEMI-BTC2610120000-HI83200",
  "asksTop": [ {"price":"0.0900","quantity":"5.00"}, {"price":"0.1100","quantity":"5.00"}, {"price":"0.2300","quantity":"25.00"} ],
  "entitlements": 3, "reason": "depth",
  "quote": { "quantity": "60.00", "limit": "0.24", "est": "13.45", "max": "15.60", "avg": "0.2125" }
```

## Tests

```bash
pnpm test           # 74 unit tests: fees, book walking, matching on real listings, fill counting, URL safety
pnpm test:db        # 10 tests against local Postgres: concurrent claims, double allocation, budget overrun
pnpm test:live      # read-only checks against the live sandbox inventory
```

`pnpm test:db` races 12 claims for 3 slots on separate connections. Exactly 3 succeed.

## Layout

```
apps/service             Fastify API, SSE, job worker, agent, planner, executor
apps/web                 Next.js workspace, plan card, claim page
packages/domain          zod schemas, run state machine, event vocabulary, plan hashing
packages/risk-engine     fees, fee ceiling, book walk, sizing, matching, scenarios
packages/provider-context  Context.dev wrapper: credit meter, per-output checks, SSRF guard, webhooks
packages/provider-gemini   Gemini wrapper: inventory, depth, executor, reconciliation, fill ledger
supabase/migrations      schema, constraints for every financial invariant, row security
fixtures                 captured provider payloads for tests, preflight manifests
docs                     PRD, architecture, decisions
```

[docs/architecture.md](docs/architecture.md) covers who decides what, the execution path, and where each PRD invariant is enforced. [docs/decisions](docs/decisions) records why the executable demo uses crypto and not sports.

## Known limits

- Sandbox liquidity is thin and mostly in contracts settling within the hour, so campaigns are small (3 rewards in the run above). The UI says so instead of hiding it.
- Fees for REST-reconciled orders use the published formula unless the private order stream reported them; the receipt labels which.
- Weather and sports matches are analysis only until those categories appear in sandbox

## Credits

The workspace UI follows the design language of [OpenMuse](https://github.com/CopilotKit/OpenMuse) (MIT): tool cards, browser activity, and the review handoff.
