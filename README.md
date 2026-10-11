# Beagle

an agent that understands your business, finds a matching prediction market, and puts together a hedge within your budget.

## the problem

a business can do everything right and still lose money because something outside its control changes.

a heat wave delays a week of jobs. prices move before a supplier gets paid. revenue disappears, but wages and rent keep coming etc.

traditional insurance doesn't always cover those losses.

prediction markets put prices on some of these events. but finding a market is only the first step. someone still has to read the settlement rules, check the liquidity, calculate the payout, and figure out how closely it matches the business's actual risk.

business owners already know what could hurt them. turning that into a useful hedge is the hard part.

## how beagle helps

beagle does that work.

you explain what could go wrong and how much you're willing to spend. beagle researches your business, finds a relevant prediction market, and works out how its payout could offset your exposure.

you see the cost, what triggers the payout, and where the coverage falls short.

then you decide. one approval, a clear spending limit, and an order sized to what the market can actually fill.

we're building a way for a business owner to go from “this could cost us money” to “here's what we can do about it.”

## Example

a painting company has $8,000 worth of outdoor jobs booked for next week.

a heat wave could force them to reschedule. crew wages and equipment rentals still need paying.

they ask beagle: “we could be out $1,000 if Friday is too hot to work. can we hedge some of that with a $100 budget?”

beagle looks for a weather contract and checks its temperature threshold, date, settlement location, and liquidity.

if it settles at SFO airport while the jobs are inland, beagle flags the mismatch. the job sites could get much hotter than the airport.

the company can see what the contract would pay, when it would pay, and where it could fall short.

weather contracts are research-only in this build. purchases currently run through Gemini’s crypto sandbox.

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

https://github.com/user-attachments/assets/YOUR_VIDEO_ID

## built with

Context.dev, Gemini Predictions API, Anthropic, Next.js, Fastify, and Supabase.

crew art from [OpenDots](https://github.com/CopilotKit/OpenDots), workspace inspiration from [OpenMuse](https://github.com/CopilotKit/OpenMuse). both MIT licensed.

built for Blockchain at Berkeley Hacks 2.0, the Gemini Predictions API track, and the Context.dev bonus.
