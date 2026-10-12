# Beagle

![Beagle Insurance](docs/media/banner.jpg)

businesses are exposed to financial risks that traditional insurance often doesn't cover. prediction markets have started putting prices on those events, but business owners don't know how to use them. beagle is the agent that understands the business, finds a matching market, calculates what's actually protected, and executes a bounded hedge.

**try it: [beagle.andrewliu.org](https://beagle.andrewliu.org)**. no sign up. you get your own workspace and a real agent.

## where the idea came from

in june a bar on the upper east side went viral for promising free tabs, up to $100, to everyone there before tip-off if the knicks won game 1 of the finals. the owner had already been burned once: an earlier promo knocking 1% off tabs for every point the knicks won by cost him $4,000. so this time he hedged it on a prediction market. ([fortune](https://fortune.com/2026/06/03/nyc-bar-knicks-kalshi-win-prediction-market/))

it only happened because someone at the exchange saw the story and walked him through the trade. most owners don't have that. they don't know a market exists for their risk, which contract actually matches it, or how much to buy. we built beagle so any business can do what that bar did, from one sentence.

## why this is new

insurance is built for risks that repeat across thousands of customers. a sports bar staking its margin on one game night, a builder whose financing gets worse if the Fed doesn't cut, a business whose next contract depends on how an election goes: these are too specific and too short-lived to underwrite. they usually just go uncovered.

prediction markets already price exactly these events. Gemini lists 511 sports markets, 221 political ones and the Fed's next decisions right now. but a contract is not a policy. it pays on its own wording, on its own date, from its own resolution source, and the price on the screen is only good for the size on the book. a business owner can't tell from "Fed decision in October? / Cut 25bps" whether that covers them, or how much of it.

that translation is what beagle does:

- it reads the business and the contract rules and checks them field by field. when they don't line up it says so, like a promotion that pays on the final score against a contract that only counts regulation time, instead of selling a near-miss.
- it sizes the hedge against the real order book with the real fees, so the number on the plan is what the market can actually fill.
- it tells you what is protected and what is not before anything is spent. if the book only covers 3 of the 10 rewards you asked for, the plan says 3.
- the downside is fixed. you approve one exact plan with a hard maximum, it goes out as a single fill-or-kill order, and nothing else is ever bought.

## what that looks like

**a game night promotion.** the knicks bar, for any team. a sports bar in Baltimore wants to say "if Baltimore beats Atlanta Monday night, $20 back on your tab", without a packed night turning into thousands of dollars of payouts. beagle finds the Baltimore vs Atlanta market, checks that YES pays on Baltimore and on the official final result, flags what happens on a tie and on a cancelled game, and sizes a hedge so the bar only publishes as many $20 rewards as the payout can cover.

**a rate decision.** a builder carrying a floating-rate construction loan loses money every month the Fed doesn't cut. beagle matches that to the "Cut 25bps" bucket of the Fed's October decision, reads that it is decided on October 28 and verified from the Federal Reserve, and warns that the buckets are mutually exclusive: a 50bp cut pays a different contract, and if the meeting is canceled only "maintains" pays.

**an election.** a Texas business whose pipeline depends on who wins the Senate race can hedge the outcome it is exposed to. beagle matches the candidate, quotes the resolution source (the state election authority) and warns that the payout follows the certified result, which a recount can push well past election night.

these markets list on Gemini's production exchange today. beagle reads and matches them there, and places orders on Gemini's sandbox, which only lists crypto right now, so that's where the live orders below come from.

## see it run

![a live run on beagle.andrewliu.org, about 5x speed](docs/media/live-run.gif)

*a first-time visitor on the public site asks for the knicks promo, recorded unedited and played back at about 5x. beagle finds the real Knicks vs Timberwolves market on Gemini, checks game, league, date, which team YES pays on and the final-result rule, flags what happens if the game is cancelled, and names the one thing that doesn't line up: the game is listed on Gemini's production exchange, and beagle places orders on the sandbox.*

![the knicks game, matched field by field](docs/media/live-match.png)

## the crew

each card tells you who did the work.

<p>
  <img src="apps/web/public/crew/scout-192.png" width="48" alt="Scout">
  <strong>Scout</strong><br>
  researches your business through Context.dev and talks to you.
</p>

<p>
  <img src="apps/web/public/crew/nova-192.png" width="48" alt="Nova">
  <strong>Nova</strong><br>
  searches Gemini markets, checks live books and contract terms.
</p>

<p>
  <img src="apps/web/public/crew/penny-192.png" width="48" alt="Penny">
  <strong>Penny</strong><br>
  sizes the hedge, handles the budget, sends the approved order, and keeps the receipt.
</p>

<p>
  <img src="apps/web/public/crew/sprout-192.png" width="48" alt="Sprout">
  <strong>Sprout</strong><br>
  runs the test campaign and customer claims.
</p>

they bob while working, lean when waiting on you, and grey out when a provider is disconnected.

sandbox liquidity is thin, so campaigns stay small. all trades and rewards are for testing.

## demo

you describe the risk in plain words. Scout reads the web through Context.dev, Nova pulls every Gemini contract and the live order book, and Penny sizes a hedge against what is actually on offer.

![asking beagle](docs/media/home.gif)

orders go to Gemini's sandbox, and the sandbox only lists crypto right now, so the plan, fill and campaign below ran on a bitcoin contract. it's the same engine the knicks game goes through above.

Penny's plan is the only thing you approve. it shows the estimate and the hard maximum separately, what would not pay, and why the coverage is smaller than you asked for when the book is thin.

![the plan](docs/media/live-plan.png)

after the fill Sprout opens the campaign. it only publishes as many rewards as the confirmed contracts can pay, and customers claim from a QR code.

![hedge confirmed and campaign live](docs/media/live-operating.png)

<p>
  <img src="docs/media/claim.gif" width="280" alt="a customer claiming a reward">
  <img src="docs/media/claim-phone.png" width="280" alt="customer claim page">
</p>

the portfolio only counts reconciled fills, never the submit response.

![portfolio](docs/media/portfolio.png)

## what actually happened

this is not a mock. every number below came off the Gemini sandbox.

on 2026-10-11 23:40:52 UTC beagle bought 10 YES on `GEMI-BTC2610120000-HI83500` (BTC at or above $83,500 at 8pm EDT) at $0.10, fill-or-kill, Gemini order `145853902277682301`. it booked $1.00 principal plus $0.07 fee, which was the plan's estimate to the cent, then opened a 10 reward campaign that took its first claim. BTC closed above the strike and the contract paid $10.00 back into the sandbox account.

on 2026-10-12 at 00:40 UTC the run in the recording above, started by a first-time visitor on the public site, got 3 YES on `GEMI-BTC2610120100-HI83900` at an average $0.1333, Gemini order `145853902277805116`: $0.40 principal plus $0.03 fee against a $0.55 estimate and a $0.66 approved max.

that run shows the matching being strict. the visitor asked for "above $83,000". the contract had no $83,000 strike, so the agent rewrote the customer promise to $83,200 rather than hedge something that settles differently. that book was too thin, so the engine moved to $83,900 and the plan said it covered 3 of the 10 rewards asked for. filming it also caught a bug: the campaign headline moved to $83,900 but the agent's fine print still said $83,200 and "the first 10 customers". the planner now rewrites both to what was actually bought.

## how it works

- the agent works through typed tools: search and read the web, list Gemini contracts, inspect a contract with its live depth, record evidence, and propose a plan. it cannot buy anything. a finding only counts as evidence if the quoted passage exists in the captured page.
- quotes come from observed book levels with Gemini's published taker fee, `0.07 * C * P * (1 - P)` rounded up per fill. nothing extrapolates past the book.
- a plan is an immutable version bound by a sha256 hash. approving it reserves the max debit, and the order goes out as one fill-or-kill limit order.
- holdings come from Gemini order history and positions after the fact. if a submit times out the run sits in `EXECUTION_UNKNOWN` with funds reserved until reconcile finds the order.
- the money rules live in Postgres, not just in code: no oversubscribed holdings, plans can't be edited after the fact, one order per approval, and claims go through a function that locks the row, so 12 concurrent claims for 3 slots give exactly 3.
- jobs run off a Postgres queue with `SKIP LOCKED` leases. on Vercel there is no long running worker, so each request drains due jobs after it responds and the event stream reads the log, which means any instance can serve any run.

more detail in [docs/architecture.md](docs/architecture.md) and [ADR 0001](docs/decisions/0001-sandbox-inventory-drives-the-demo.md).

## run it locally

needs Node 22+, pnpm, Docker, and the Supabase CLI.

```bash
pnpm install
pnpm db:start                       # local supabase on 553xx ports
cp .env.example .env                # fill in the Context.dev, Gemini sandbox and model keys
pnpm --filter @beagle/service seed  # demo operator + Golden Bear Taproom
pnpm dev:service                    # :4000
pnpm dev:web                        # :3100
```

`pnpm preflight` checks every provider and quotes the live sandbox book without placing anything. Gemini master keys need `GEMINI_ACCOUNT` and `GEMINI_NONCE_MODE=time-based`.

```bash
pnpm test        # 83 unit tests: fees, book walking, quoting, matching, fill ledger, master key signing, campaign copy
pnpm test:db     # 10 database invariant tests against local supabase
```

## known limits

- Gemini's sandbox only lists crypto and commodities, and its depth sits almost entirely in contracts settling within the hour. sports, rate decision and election matches are reference only until those markets show up in sandbox, and sandbox campaigns stay small.
- that hourly book moves every few seconds. a plan can go unfillable before you click approve, and the button stays disabled until it fits again. there is no one click re-quote yet.
- Gemini's websocket rejects master API keys, so with one the fees are booked from the published formula instead of the per-fill stream. the receipt says which.
- the public demo caps each visitor at 6 new runs an hour since every run spends real model and Context.dev credits.

## built with

Context.dev, Gemini Predictions API, Anthropic, Next.js, Fastify, and Supabase.

crew art from [OpenDots](https://github.com/CopilotKit/OpenDots), workspace inspiration from [OpenMuse](https://github.com/CopilotKit/OpenMuse). both MIT licensed.

built for Blockchain at Berkeley Hacks 2.0, the Gemini Predictions API track, and the Context.dev bonus.
