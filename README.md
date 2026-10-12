# Beagle

![Beagle Insurance](docs/media/banner.jpg)

an agent that understands your business, and uses prediction markets to build a protection plan within your budget.

**try it: [beagle.andrewliu.org](https://beagle.andrewliu.org)**. no sign up. you get your own workspace, a real agent, and real Gemini sandbox orders (test money).

## the problem

business owners know what could hurt them. finding traditional insurance that covers it is hard. some risks just don't fit the policies they can buy.

we built beagle around the idea of nontraditional insurance. prediction markets already put prices on some of these events. we think they can help businesses fill those gaps.

tell beagle what you're worried about and what you can spend. it finds a matching contract, checks the terms, and works out how much the payout could help. you see the cost and what's still uncovered before you approve.

the opportunity is to make protection accessible for risks that traditional policies leave behind.


## how beagle helps

you explain what could go wrong and how much you're willing to spend. beagle researches your business, finds a relevant prediction market, and works out how its payout could offset your exposure.

you see the cost, what triggers the payout, and where the coverage falls short.

then you decide. one approval, a clear spending limit, and an order sized to what the market can actually fill.

we're building a way for a business owner to go from "this could cost us money" to "here's what we can do about it."

## Example

a restaurant wants to bring more people in for game night.

the offer: "if our team wins, get $20 back on your meal."

that creates a new risk. a busy night and a win could leave the restaurant paying out hundreds of dollars.

the owner asks beagle: "can we run this promotion with a $350 hedge budget, including fees?"

beagle researches the restaurant, looks for a contract tied to the same game, and checks that the reward condition matches the contract's settlement rules.

then it calculates the cost and how many $20 rewards the hedge could support.

when a matching sandbox contract is available, the owner approves the plan and beagle places the order. test rewards only open after the fill is confirmed, and enrollment stops when the funded slots run out.

the restaurant gets a promotion with a clear cost and a fixed reward limit.

sports promotions are research-only in the current build because sandbox has no sports listings. the executable promotion demo uses a crypto event.

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

watch the crew turn a business risk into a hedge plan.

![a live run on beagle.andrewliu.org, about 5x speed](docs/media/live-run.gif)

*a first-time visitor on the public site, recorded unedited and played back at about 5x. research, plan, approval and a real sandbox fill in about two and a half minutes.*

you describe the risk in plain words. Scout reads the web through Context.dev, Nova pulls every Gemini contract and the live order book, and Penny sizes a hedge against what is actually on offer.

![asking beagle](docs/media/home.gif)

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

on 2026-10-12 at 00:40 UTC a first-time visitor on the public site (the recording above) got 3 YES on `GEMI-BTC2610120100-HI83900` at an average $0.1333, Gemini order `145853902277805116`: $0.40 principal plus $0.03 fee against a $0.55 estimate and a $0.66 approved max.

that run is a good example of why the matching is strict. the bar asked for "above $83,000". the agent found the 9pm event has no $83,000 strike (the lowest is $83,200), so it rewrote the customer promise to match the contract instead of the other way round. the $83,200 book was then too thin, so the quote engine moved to the $83,900 strike, covered 3 of the 10 rewards the bar asked for, and said so on the plan. filming it also caught a bug: the campaign headline moved to $83,900 but the agent's fine print still said $83,200 and "the first 10 customers". the planner now rewrites both to what was actually bought.

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

- Gemini's sandbox only lists crypto and commodities, and its depth sits almost entirely in contracts settling within the hour. sports and weather matches are research only until those show up in sandbox, and campaigns stay small.
- that hourly book moves every few seconds. a plan can go unfillable before you click approve, and the button stays disabled until it fits again. there is no one click re-quote yet.
- Gemini's websocket rejects master API keys, so with one the fees are booked from the published formula instead of the per-fill stream. the receipt says which.
- the public demo caps each visitor at 6 new runs an hour since every run spends real model and Context.dev credits.

## built with

Context.dev, Gemini Predictions API, Anthropic, Next.js, Fastify, and Supabase.

crew art from [OpenDots](https://github.com/CopilotKit/OpenDots), workspace inspiration from [OpenMuse](https://github.com/CopilotKit/OpenMuse). both MIT licensed.

built for Blockchain at Berkeley Hacks 2.0, the Gemini Predictions API track, and the Context.dev bonus.
