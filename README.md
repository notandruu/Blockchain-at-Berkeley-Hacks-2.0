# Beagle

a little crew of agents that researches a business risk, finds a hedge, and buys it after you approve.

## the idea

say you run a bar.

“if Bitcoin is above $83,200 at 8pm, you get $20 back on your tab.”

fun promo. now you need a way to cover those payouts.

beagle finds a prediction market contract tied to that event, checks the fine print, and figures out how much the live market can actually support.

## what happens

you describe the risk and set a budget.

beagle researches your business through Context.dev, searches Gemini’s markets, and shows you the cost, coverage, and any gaps.

you approve once. it places a fill-or-kill order in Gemini’s sandbox.

the campaign only gets as many test rewards as the confirmed fill can pay for. enough liquidity for three rewards? three rewards it is.

we also tried a painting crew worried about heat. beagle found a weather contract and flagged the catch: it settles at SFO airport, not the job site.

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

## built with

Context.dev, Gemini Predictions API, Anthropic, Next.js, Fastify, and Supabase.

crew art from [OpenDots](https://github.com/CopilotKit/OpenDots), workspace inspiration from [OpenMuse](https://github.com/CopilotKit/OpenMuse). both MIT licensed.

built for Blockchain at Berkeley Hacks 2.0, the Gemini Predictions API track, and the Context.dev bonus.
