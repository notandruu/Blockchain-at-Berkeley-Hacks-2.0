# Beagle

an agent that understands your business, finds a matching prediction market, and puts together a hedge within your budget.

## the problem

business owners know what could hurt them. finding traditional insurance that covers it is harder. some risks fall outside the policies they can buy.

we built beagle around the idea of nontraditional insurance. prediction markets already put prices on some of these events. we think they can help businesses fill those gaps.

tell beagle what you're worried about and what you can spend. it finds a matching contract, checks the terms, and works out how much the payout could help. you see the cost and what's still uncovered before you approve.

the opportunity is to make protection accessible for risks that traditional policies leave behind.


## how beagle helps

you explain what could go wrong and how much you're willing to spend. beagle researches your business, finds a relevant prediction market, and works out how its payout could offset your exposure.

you see the cost, what triggers the payout, and where the coverage falls short.

then you decide. one approval, a clear spending limit, and an order sized to what the market can actually fill.

we're building a way for a business owner to go from “this could cost us money” to “here's what we can do about it.”

## Example

a restaurant wants to bring more people in for game night.

the offer: “if our team wins, get $20 back on your meal.”

that creates a new risk. a busy night and a win could leave the restaurant paying out hundreds of dollars.

the owner asks beagle: “can we run this promotion with a $350 hedge budget, including fees?”

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

https://github.com/user-attachments/assets/YOUR_VIDEO_ID

## built with

Context.dev, Gemini Predictions API, Anthropic, Next.js, Fastify, and Supabase.

crew art from [OpenDots](https://github.com/CopilotKit/OpenDots), workspace inspiration from [OpenMuse](https://github.com/CopilotKit/OpenMuse). both MIT licensed.

built for Blockchain at Berkeley Hacks 2.0, the Gemini Predictions API track, and the Context.dev bonus.
