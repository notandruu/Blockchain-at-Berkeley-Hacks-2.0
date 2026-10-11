# Beagle

an agent that understands your business, finds a matching prediction market, and puts together a hedge within your budget.

## the problem

businesses take on financial risks every day. a heat wave delays jobs. a sudden price change eats into margins. traditional insurance can leave gaps.

prediction markets put prices on those events. but a business owner still has to find the right contract, understand the settlement rules, and figure out whether it actually helps.

that’s where beagle comes in.

## what beagle does

you describe your business, the risk, and your budget.

beagle researches the situation, finds a matching market, calculates the potential payout, and explains what remains exposed.

you get a plan with the cost, coverage gaps, and a clear spending limit. after you approve, beagle executes the hedge in Gemini’s sandbox.

## an example

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
