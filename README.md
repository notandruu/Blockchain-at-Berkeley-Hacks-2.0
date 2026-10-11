# Beagle

a little crew of agents that researches a business risk, finds a hedge, and buys it after you approve.

## the idea

say a painting company has $8,000 worth of outdoor jobs booked for next week.

a heat wave could push those jobs back. the company still has crew wages and equipment rentals to pay.

they ask beagle: “we could be out $1,000 if Friday is too hot to work. can we hedge some of that with a $100 budget?”

## what happens

beagle researches the risk and looks for a weather contract that pays if temperatures cross a certain threshold.

it checks the date, temperature, settlement location, price, and available liquidity. then it explains how much of the company’s exposure the contract could cover.

the details matter. if the contract settles at SFO airport and the jobs are inland, beagle flags that gap. the temperature at the airport could stay below the threshold while the crew’s job sites get much hotter.

the company gets a plan it can review, with the cost and coverage gaps spelled out.

weather contracts are research-only in this build. purchases currently run through Gemini’s crypto sandbox.

## the crew

each card tells you who did the work.

| | Who | Does |
|---|---|---|
| <img src="apps/web/public/crew/scout-192.png" width="48"> | Scout | Researches your business through Context.dev and talks to you |
| <img src="apps/web/public/crew/nova-192.png" width="48"> | Nova | Searches Gemini markets, checks live books and contract terms |
| <img src="apps/web/public/crew/penny-192.png" width="48"> | Penny | Sizes the hedge, handles the budget, sends the approved order, keeps the receipt |
| <img src="apps/web/public/crew/sprout-192.png" width="48"> | Sprout | Runs the test campaign and customer claims |

they bob while working, lean when waiting on you, and grey out when a provider is disconnected.

sandbox liquidity is thin, so campaigns stay small. all trades and rewards are for testing.

## Demo

(link)

## built with

Context.dev, Gemini Predictions API, Anthropic, Next.js, Fastify, and Supabase.

crew art from [OpenDots](https://github.com/CopilotKit/OpenDots), workspace inspiration from [OpenMuse](https://github.com/CopilotKit/OpenMuse). both MIT licensed.

built for Blockchain at Berkeley Hacks 2.0, the Gemini Predictions API track, and the Context.dev bonus.
