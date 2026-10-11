# RiskPilot
## Product requirements and implementation plan

**Version 1.0 | 11 October 2026**

**Product** An agent that researches a business risk, identifies a relevant prediction market contract, explains the protection and its limits, and buys an authorized hedge.

**Primary demo** A sports bar launches a fixed, event dependent customer reward. **Second workflow** An outdoor business evaluates a temperature related income risk through the same engine.

**Experience** Describe the goal. Watch sourced research. Review one plan. Approve the purchase. See the confirmed position and what happens next.

**Build boundary** Real Context.dev requests, real Gemini sandbox execution, test customer claims, and clearly separated outcome simulations. No production money or insurance issuance.

# 1. Product thesis and scope

RiskPilot is a financial risk assistant, not a sports betting dashboard and not a general insurance marketplace. Its reusable unit is an exposure linked to an externally verifiable event. A promotion intentionally creates an exposure. An outdoor job creates an operational exposure. Both enter the same research, contract matching, quotation, authorization, execution, and monitoring pipeline.

The bar is the most understandable demonstration because the reward condition can be written to match a contract. The contractor establishes the platform's breadth and its ability to reject imperfect protection. Neither workflow should claim that a market payout guarantees business profitability.

## Outcomes to prove

The merchant can understand why a particular event matters, see what would and would not pay, approve a bounded purchase, and receive a traceable execution receipt. A customer cannot acquire a promotional entitlement that exceeds confirmed allocated coverage. A second industry uses the same RiskSpec and risk calculator rather than a separate scripted demo.

For the sponsor tracks, Context.dev must change a consequential decision through retrieved evidence. Gemini must execute a real sandbox order and provide the position information that governs the application's behavior. API call count is not the success measure.

## Scope decisions

| Priority | Deliverable | Completion boundary |
|---|---|---|
| P0 | Agent workspace and source viewer | Actual queries, retrieved passages, screenshots, timestamps, and provider receipts |
| P0 | Sports promotion workflow | Research through approval, confirmed hedge, bounded test claims, and reconciliation preview |
| P0 | Temperature risk workflow | Merchant supplied exposure, sourced assessment, real market discovery, and an explicit match decision |
| P0 | Risk engine and execution controls | Correct sizing, fee reservation, immutable approval, execution recovery, and allocation invariants |
| P0 | Portfolio and audit trail | Only actual app records and reconciled sandbox positions; proposals are visibly distinct |
| P1 | Context page monitoring | Verified change events can prompt review or pause new promotional eligibility |
| P1 | Additional approved tranches | Fresh approval by default; optional explicitly enabled campaign allowance |
| P2 | Economic and political risk adapters | Discover and analyze real inventory; execution requires an implemented trigger verifier |
| Out | Production insurance and commerce | No insurance underwriting, customer deposits, real alcohol offers, real refunds, pooled capital, leverage, or short selling |

Do not build Shopify, Stripe, wallet onboarding, Solidity contracts, multiagent debates, or an arbitrary computer control system for this submission.

# 2. Users, jobs, and required inputs

**Merchant.** Wants to make a compelling offer or reduce an existing risk without learning how to trade. Supplies a business URL, the financial amount at risk, the applicable date and location, and a maximum spend. The URL can establish positioning and services, but not private margins, customer demographics, or revenue.

**Demo customer.** Claims a test promotional entitlement from a mobile page. Has no Gemini account and never receives a financial instrument. Their record is a simulated merchant obligation, not a trade.

**Operator.** Connects the team's sandbox account, checks permissions and accepted exchange terms, selects eligible demo instruments, and operates clearly labeled replay controls.

| Risk input | Promotion example | Operational example |
|---|---|---|
| Business context | Venue URL and merchant confirmed local team | Contractor URL and job location |
| Financial exposure | Fixed $20 reward per eligible test tab | Owner supplied lost contribution or unavoidable cost |
| Event condition | Exact team wins exact game under specified rules | Specified station's official daily high exceeds a threshold |
| Window | Enrollment closes before the game starts | Job date, observation date, and time zone |
| Budget | At most $350 in test USD, including fees | Merchant chosen hedge budget |
| Limits | Maximum claims, price ceiling, campaign end | Maximum position, acceptable mismatch, expiry |

The agent asks only for material missing information. It can propose assumptions in an editable card but cannot silently fabricate financial inputs. For a contractor, $3,000 of booked revenue is not automatically $3,000 of economic loss. Separate revenue, avoided costs, unavoidable costs, and timing needs.

# 3. Primary user journey

## Start

The home screen asks, **"What would you like to protect?"** A single composer accepts a business URL and a goal. Two starter cards say **Run an event promotion** and **Protect an existing risk**. They seed a prompt rather than launching separate applications.

The bar prompt can be: "Help our bar bring people in for an upcoming game. We can spend $350. Research a relevant offer and prepare a hedge for my approval."

Immediately return a persisted run ID and a short status. Research begins without requiring approval for every read. The workspace displays the business context and any missing inputs.

## Research and match

The worker retrieves public business evidence and discovers Gemini sandbox inventory in parallel. The agent selects a small candidate set, gathers relevant facts, and produces a source backed comparison. Hard eligibility checks happen before marketing relevance ranking.

Show rejected alternatives with concrete reasons, such as an incompatible game period, a different weather station, an expired market, or insufficient observed depth. Never show a made up contract to complete the story.

## Review

The workspace becomes a plan with one recommended option and an expandable alternative. The merchant sees the event, conditional payout, proposed quantity, estimated total debit, authorized maximum debit, maximum promotional capacity, price ceiling, expiry, and residual risks.

The main action is **Approve and buy**. Editing the trigger, quantity, limits, or campaign wording creates a new plan version. A previous approval cannot apply to the edited plan.

## Execute and operate

The server revalidates the quote and permissions, reserves the approved budget, and submits the order. It first shows **Order submitted**, not **Protected**. After confirmed executions and reconciliation, the receipt replaces the approval card. A promotion becomes available only to the extent that coverage is confirmed and allocated.

Subsequent market monitoring, evidence refresh, and pausing new enrollment are automatic. New financial purchases require another approval unless the merchant explicitly enabled a bounded allowance. The ordinary demo has one purchase approval, not silent trading permission inferred from a chat message.

# 4. Demo storyboard and narrative

Use a future game with a valid sandbox instrument discovered during preflight. Team names, dates, and instrument IDs come from that instrument. Do not hardcode "Warriors tonight" independently of available markets.

| Beat | On screen | What actually happens |
|---|---|---|
| Hook | Customer preview: "If our team wins, get $20 back" | A test campaign preview, not an active customer promise |
| Goal | Merchant submits a URL and $350 limit | A persisted research job starts |
| Visible work | Source browser visits venue and event evidence | Actual Context search and scrape requests, with captured pages |
| Decision | Relevant game selected; unsuitable alternative rejected | Contract matching and deterministic quote calculation |
| Approval | Estimate, maximum debit, conditional payout, and caveats | One explicit approval for a versioned purchase and campaign |
| Execution | Gemini receipt and funded capacity | Genuine sandbox order, fill processing, and portfolio update |
| Participation | Judge scans a QR code and claims a test reward | Database transaction reserves an existing allocation |
| Constraint | Remaining capacity reaches zero | New claims stop. Existing entitlements remain intact |
| Breadth | Open the contractor risk in the same workspace | Same research, contract matching, and quote components |
| Outcome | Win, lose, or mismatch scenario panel | Clearly labeled simulation, separate from exchange settlement |

The preferred presentation devotes most attention to the bar, then briefly shows the contractor's different trigger and mismatch warning. A third political or economic risk may appear as **Research only**. It must not appear as a purchased hedge unless it really is one.

Suggested opening: "Here is a bar that wants to promise customers $20 back if their team wins, without accepting unlimited promotional exposure. The owner gives our agent a budget. It researches the venue, finds an exact contract, and comes back with a plan they can approve."

Suggested transition: "The bar creates a risk. This contractor already has one. The same engine can evaluate both, including saying when a contract would not protect the business."

# 5. Information architecture and screens

Use an assistant workspace as the primary product, with portfolio surfaces supporting it. Do not open on a dense grid of charts.

| Route | Purpose | Main components |
|---|---|---|
| `/` | Start or resume work | GoalComposer, StarterCards, RecentRuns |
| `/runs/[id]` | Research, plan, and approval | Conversation, AgentWorkspace, Sources, PlanCard |
| `/risks` | Proposed and active exposures | Filtered list, status, business, next action |
| `/risks/[id]` | Monitor one exposure | TriggerComparison, PositionReceipt, ScenarioPanel, Timeline |
| `/portfolio` | Review actual financial activity | Cash spent, conditional payouts, allocations, pending orders |
| `/campaigns/[id]` | Operate a promotion | Capacity, test claims, cutoff, preview, pause control |
| `/c/[slug]` | Customer test page | Offer, eligibility, claim button, test voucher |
| `/settings/connections` | Operator setup | Context status, Gemini sandbox status, permissions, terms |
| `/demo` | Presenter controls | Claim burst, replay scenario, health checks, isolated reset |

At a 1440 px desktop viewport, use a 208 px sidebar, a 56 px top bar, 24 px main gutters, and a main grid with a 360 px conversation column and a flexible workspace of at least 560 px. Keep the workspace width stable when its content changes.

Below 1100 px, collapse navigation and allow the conversation to become a drawer. Below 768 px, use tabs for Conversation, Work, and Plan. The approval action remains visible without covering the risk disclaimer or price limits.

Navigation contains New task, Risks, Portfolio, and Campaigns. Connection health sits in the footer. A compact environment badge always says **Gemini sandbox**. Do not use a global green "Live" badge that hides which parts are simulated.

# 6. Visual design system

The design direction is a calm, modern agent application: generous space, a compact conversation, visible evidence, and a clear approval handoff. Grok Bot's documented computer preview is a useful interaction reference, but RiskPilot's default preview is a captured source page, not a remote desktop. [S01]

Use a light application shell with a restrained dark browser chrome. Keep all financial controls visually sober. The customer campaign may inherit a merchant accent, but the risk workspace retains its own system.

| Token | Specification |
|---|---|
| Canvas | `#F7F8FA` |
| Surface | `#FFFFFF` |
| Elevated neutral | `#F0F2F5` |
| Primary text | `#16181D` |
| Secondary text | `#626A77` |
| Border | `#E3E7EC` |
| Primary action | `#17191D`, with white text |
| Active or success accent | `#087F6D`, always with a text label |
| Warning | `#A65E00`, on a pale neutral warning surface |
| Error | `#B42318` |
| Typography | Geist Sans or an available licensed equivalent; system fallback |
| Numeric text | Tabular numerals; monospace only for IDs and code |
| Type scale | 36 px title, 24 px section, 16 px primary text, 14 px body, 12 px metadata |
| Spacing | 4 px base; prefer 8, 12, 16, 24, and 32 px gaps |
| Radius | 10 px controls, 16 px cards, 20 px source browser |
| Shadow | One soft elevation layer, reserved for overlays and browser surface |

Avoid glowing shields, spinning globes, rainbow gradients, fake terminal output, and a price chart dominating the page. The central artifact is the plan. Public reward pages can feel celebratory; a financial purchase button should not pulse, rush, or celebrate before a fill exists.

Use shadcn/ui primitives styled to these tokens, rather than shipping the default template unchanged. Next.js App Router provides the app structure; Motion for React supplies state transitions. These are implementation choices, not dependencies of the financial model. [S02, S03, S04]

# 7. Agent workspace and honest visible work

## Source browser

The right panel starts as a compact browser frame with a domain, page title, fetch timestamp, and **Context.dev capture** label. A short filmstrip shows the pages already read. Clicking a previous source opens its captured state and associated evidence, not a fresh untracked page.

Context Scrape can return screenshot, Markdown, and Highlights outputs. Screenshots arrive as inline base64 data URLs, not hosted links. Decode approved image types on the server, enforce size limits, store in a private bucket, and return a short lived signed URL. Do not stream the base64 image through every agent event. [S05, S06]

Highlights are relevant Markdown passages. They are not guaranteed pixel coordinates on the screenshot. Display them as linked evidence cards below the image, or in a reader view. Only place a highlight overlay on screenshot pixels after implementing and verifying a real DOM to image mapping. [S07]

The browser should show a real capture when one exists, a text reader fallback when only text succeeded, and an explicit capture error when neither succeeded. Do not iframe arbitrary merchant pages into the privileged app.

## Activity representation

While a request is in progress, show its actual domain and objective: "Reading the venue's events page" or "Checking the contract's settlement source." Once it completes, show the evidence found. The agent's explanations are brief action summaries and decision rationales, not a transcript of private reasoning.

Each tool wrapper emits started, completed, or failed events. These drive the interface. A long request can keep an indeterminate indicator moving, but the app must not invent successful searches, browsing clicks, or a numerical completion percentage.

Context supports browser actions before capture on eligible paid plans. They can reveal necessary page content, but are not required for the demo. Do not imply a continuous computer video stream from a scrape response. [S08]

## Four workspace states

| State | Main visual | Supporting content |
|---|---|---|
| Researching | Source browser and evidence cards | Current objective, completed sources, candidate count |
| Evaluating | Candidate comparison | Exact trigger checks, exclusions, executable quote |
| Awaiting approval | Stable PlanCard | Evidence drawer, assumptions, price age, full limits |
| Operating | Execution receipt and capacity | Position, claims, next action, scenario preview |

Keep one primary visual at a time. Provider receipts and full logs are expandable, not a wall of JSON presented to the merchant.

# 8. Motion and feedback specification

All motion is driven by persisted state or real in flight requests. Use transform and opacity for routine transitions. Support reduced motion and keyboard access from the beginning. Motion for React supports component and layout animation; the timings below are design choices. [S04]

| Interaction | Motion | Truth condition |
|---|---|---|
| Run starts | Small status dot breathes over 1.6 seconds | Backend accepted the run |
| Tool starts | Icon fades in; indeterminate line animates | Actual provider request began |
| Source returns | Image crossfades over 160 ms | Successful screenshot artifact exists |
| Evidence arrives | Card fades and rises 6 px over 180 ms | Retrieved passage was persisted |
| Candidate rejected | Warning label appears without shake | Validation emitted a reason code |
| Plan ready | Workspace height settles over 220 ms | Valid plan version was saved |
| Approval pending | Button holds still with a clear maximum debit | Awaiting human action |
| Order submitted | Neutral progress label and receipt placeholder | Request was sent, fill not confirmed |
| Fill confirmed | Check draws over 140 ms; totals update over 250 ms | Reconciled executed quantity increased |
| Claim accepted | Capacity bar shrinks and counter updates | Allocation transaction committed |
| Quote stale | Timestamp turns amber; buy control disables | Server freshness threshold exceeded |
| Reconnection | Inline reconnecting status, no full screen reset | Stream disconnected or state is being reconciled |

Use `prefers-reduced-motion` to remove spatial movement and breathing loops. Status text still changes. Screen readers receive concise `aria-live="polite"` messages, not each market tick. A source thumbnail has descriptive alternative text. Focus moves to the approval heading only after an explicit navigation action, not while the user is reading.

The interface should acknowledge an interaction within a proposed 200 ms local target and display committed claim changes within a proposed one second target. These are acceptance targets to test, not provider latency guarantees.

# 9. Backend architecture and selected stack

```text
Next.js web and mobile claim page
        |
        | authenticated HTTPS + streamed run events
        v
Persistent Node service
  Run orchestrator and durable job runner
  Context research adapter
  Gemini market and account adapter
  Deterministic policy and risk engine
  Approval and execution service
  Campaign allocation service
        |
        +-- Supabase Postgres, Auth, private Storage
        +-- Context.dev HTTPS API
        +-- Gemini sandbox REST and WebSocket
        +-- Configured language model provider
```

| Layer | Choice | Reason |
|---|---|---|
| Web | Next.js App Router, React, TypeScript | Shared language and simple routes |
| UI | Tailwind, customized shadcn/ui, Lucide | Consistent primitives without a bespoke component framework |
| Motion | `motion/react` | Small state and layout transitions |
| Agent | Vercel AI SDK tool calling, Zod schemas | Typed tool inputs and a provider configurable model |
| Language model | Anthropic Messages through `@ai-sdk/anthropic` | Configure a tool capable model the team can access; pin its ID in `AGENT_MODEL` during preflight |
| Service | Node 22.4 or later supported release, Fastify | Long lived research runs, account streams, and server credentials |
| Storage | Supabase Postgres, Auth, Storage | Durable application state, identity, and private captures |
| Numeric logic | `decimal.js` plus Postgres `numeric` | Explicit decimal arithmetic and rounding |
| Events | SSE from the persistent service | Replayable progress without exposing exchange credentials |
| Tests | Vitest and Playwright | Financial fixtures, integration checks, and user flow tests |

AI SDK tools are schema defined functions; our orchestrator decides which tools are available at each stage. The language model does not receive the raw exchange signing key or unrestricted order placement tools. Use the documented Anthropic adapter and validate the selected model against the tool schemas before the demo. [S09, S36]

Use a web service and a persistent agent service, deployed as separate services on one chosen container host. Do not place the long lived Gemini connection or durable execution loop inside a short request handler. Use a Postgres jobs table with leases and a transactional outbox for the hackathon; Redis and a second queue system are unnecessary.

Use Supabase for data and authentication, not as another realtime transport for this first version. SSE owns agent and portfolio updates. Validate user tokens and merchant membership on every privileged service request. Keep secret keys on the server, enable appropriate row policies, and explicitly grant required Data API access rather than assuming new tables are exposed. Current Supabase guidance makes both access grants and row policies relevant. [S10, S11]

# 10. Context.dev integration specification

Base URL: `https://api.context.dev/v1`. Use the `context.dev` TypeScript package with a server side `CONTEXT_DEV_API_KEY`. The coding skill is setup guidance, not an authenticated API connection. Installing it alone does not give the application live tools. [S12, S13]

| Operation | Endpoint or SDK | Role | Priority |
|---|---|---|---|
| Search | `POST /web/search`; `client.web.search` | Find official event, venue, and operational evidence | P0 |
| Read and capture | `POST /web/scrape`; `client.web.scrape` | Retrieve text, screenshots, and per output status | P0 |
| Highlights | Scrape with `formats.highlights` and `highlightsParams.query` | Narrow evidence to the question being answered | P0 |
| Structured extraction | Scrape with `formats.json` and documented JSON parameters | Optional typed fields; the core flow can extract from retrieved text | P1 |
| Brand | `POST /brand/retrieve` | Optional logo and brand context for campaign preview | P1 |
| Styleguide | `GET /web/styleguide?domain=...` | Optional observed brand colors and typography | P1 |
| Answers | `POST /web/answers` | Optional bounded research synthesis | P1 |
| Monitor | `POST /monitors` | Watch reviewed pages after activation | P1 |

Search starts with 10 results, then the agent selects a few to read. Do not invent a five result API parameter if the documented minimum remains 10. Scrape success is checked per output, not inferred from HTTP 200. The default scrape cache can be several days old; use `maxAgeMs: 0` for event critical facts and show cache age on other evidence. [S05, S14]

Application authored request example:

```typescript
const page = await contextClient.web.scrape({
  url: validatedPublicUrl,
  formats: {
    markdown: true,
    screenshot: true,
    highlights: true,
  },
  highlightsParams: {
    query: "What evidence links this venue to the selected event?",
    maxCharacters: 1800,
  },
  maxAgeMs: 0,
});
```

Validate returned outputs before storing evidence. Treat source text as untrusted data. Retain final URL, title, source timestamp when available, retrieval time, cache metadata, request ID, and the exact supporting passage. Separate **Observed fact**, **Merchant supplied**, and **Agent inference** in the data model and UI.

Brand and styleguide responses are optional enrichments, not evidence of customer demographics. Only allowlisted colors and typography choices enter the campaign template; do not execute returned CSS or scripts. Styleguide requires a domain or direct URL even where an autogenerated request example omits it. [S15, S16]

The default research allowance is a proposed 40 Context credits per run, plus a separately approved monitoring allowance. Log actual usage from returned metadata. Current documentation prices Search by result count, charges extra for Highlights and structured extraction, and distinguishes fast Answers from much more expensive ultra research. Explicitly select research mode and cap retries. [S17]

If Answers is enabled, explicitly select `mode: "fast"`, retain returned sources and partial completion status, and allow it only during setup or background monitoring. It is not a checkout dependency. [S35]

Monitor webhooks verify the raw body using the documented signature scheme, reject stale timestamps, and deduplicate event IDs. A change can invalidate a proposal or pause new enrollment. It cannot settle a Gemini position or revoke an existing customer entitlement. [S18]

# 11. Gemini integration and contract inventory

Gemini here means the exchange and its Predictions API, not Google's model. The backend uses `@gemini-markets/sdk/server`. The package requires an explicit runtime entry point, an explicit environment, and optional `ws` support for authenticated WebSocket setup. [S19]

Use `env: "sandbox"`, the team's own sandbox account, and server side HMAC credentials. The sandbox provides test funds and simulated exchange activity. Its REST origin is `https://api.sandbox.gemini.com` and its WebSocket origin is `wss://ws.sandbox.gemini.com`. Keep these origins enforced by configuration and startup checks. [S20]

| Capability | Verified operation | Use in RiskPilot |
|---|---|---|
| Categories | `GET /v1/prediction-markets/categories` | Build the actual available category list |
| Events | `GET /v1/prediction-markets/events` | Discover and paginate active candidate events |
| Exact event | `GET /v1/prediction-markets/events/{eventTicker}` | Read the selected event and contracts |
| Terms status | `GET /v1/prediction-markets/terms/status` | Check account readiness |
| Exchange terms | `GET /v1/prediction-markets/terms` | Present terms for human acceptance when required |
| Accept terms | `POST /v1/prediction-markets/terms/accept` | Only after explicit account owner consent |
| Place order | `POST /v1/prediction-markets/order` | Low frequency, approved limit purchase |
| Cancel order | `POST /v1/prediction-markets/order/cancel` | Cancel unfilled remainder when policy requires |
| Active orders | `POST /v1/prediction-markets/orders/active` | Recover pending financial commitments |
| Order history | `POST /v1/prediction-markets/orders/history` | Reconcile executions and ambiguous responses |
| Positions | `POST /v1/prediction-markets/positions` | Reconcile current holdings |
| Settled positions | `POST /v1/prediction-markets/positions/settled` | Reconcile actual exchange outcomes |

The corresponding SDK methods are on `client.predictions`, including `listEvents`, `getEvent`, `getCategories`, `placeOrder`, `getPositions`, and `getSettledPositions`. Use SDK types rather than hand copying request signatures. Positions methods have documented query parameter behavior despite using POST. [S21, S22, S23]

## What contracts are used

The MVP uses a purchased YES or NO position in an existing exchange listed event contract. It does not deploy a smart contract, create an insurance policy, mint a token, or invent a new Gemini market.

For the bar, select one exact game outcome. For the contractor, select one exact temperature threshold only when a relevant instrument exists. Political and economic categories are discoverable extensions, not a claim that all business risks have a matching hedge.

Store event ticker, instrument symbol, outcome, event and contract status, expiry, observation window, source, settlement terms URL, trade increments, and a terms snapshot hash. Follow nested child events when present. A game headline alone is not the instrument definition. [S24]

No historical documentation ticker should ship as a default live instrument. Run preflight against the same sandbox used for execution. If the relevant sports or weather market is absent, show **No executable match**. A production quote cannot be used as though it were a sandbox fill.

# 12. Market streams and execution adapter

Use public streams for current depth and authenticated account streams for state. For a low frequency demo, REST `placeOrder` is a suitable single purchase path. WebSocket order entry is a later extension, not a second competing execution implementation. [S22, S25]

The initial adapter can consume `client.websocket.public.depth(symbol, { levels: 20 })` and book ticker updates. A quote is limited to observed depth; it must never extrapolate beyond the supplied levels. Use fresh snapshots rather than implementing a fragile differential book solely for a demo.

Account streams use the documented private order, balance, and position methods. They stay on the server. Gemini's public event book is represented in YES price space. Buying YES consumes YES asks. A supported NO adapter must correctly transform opposing YES bids into NO asks using `1 - price`, with quantities and ordering verified by tests. Do not take `1 - bestAsk` as the executable price for buying NO. [S25, S26]

## Order request

Application constructed payload using verified field names:

```typescript
{
  symbol: approvedPlan.instrumentSymbol,
  orderType: "limit",
  side: "buy",
  outcome: approvedPlan.outcome,
  quantity: approvedPlan.quantity,
  price: approvedPlan.limitPrice,
  timeInForce: "fill-or-kill",
  makerOrCancel: false
}
```

Prefer a verified fill or kill purchase for a fixed initial campaign. It either acquires the entire requested position or leaves the campaign inactive. A separately tested immediate or cancel mode may accept partial coverage and publish fewer slots, but only if that fallback was part of the approved plan. Validate the instrument's quantity and price increments. [S27]

An accepted order is not confirmed coverage. Gemini documents an important distinction: immediate or cancel orders can end as CANCELED even when fully executed. Execution quantities, trade IDs, and authoritative reconciliation determine holdings. Fill events and terminal events also use executed quantity differently, so never add a terminal cumulative quantity on top of already counted individual fills. [S26, S28]

The REST OrderRequest documentation does not expose the same client order ID field implied by some generic exchange examples. Use local idempotency regardless. Do not add undocumented fields or treat an echoed client ID as an exactly once execution guarantee. On a timeout after submission, enter **Execution status unknown**, retain the budget reservation, reconcile account state, and do not blindly resend. [S22, S27]

# 13. Risk engine and financial calculations

All dollar arithmetic belongs in deterministic, tested code. The agent supplies a structured proposal, not an authoritative calculation.

Define `L(s)` as the merchant loss or reward obligation under scenario `s`, `P(s)` as the contract payout, and `C` as acquisition cost plus fees. The financial result is `L(s) + C - P(s)`. A good market match does not establish that actual business losses equal the payout.

For a $1 paying contract and a fixed reward `r`, the required quantity for `n` covered entitlements is `n * r`, rounded to the permitted quantity increment. For actual fills `q_i` at `p_i`, purchase cost is the sum of `q_i * p_i`. Capacity is the integer number of rewards supported by confirmed, unallocated payout units.

The published taker fee formula is `0.07 * q * p * (1 - p)`, with fees rounded upward to cents. The normal maker coefficient differs; a temporary maker waiver must not become a permanent assumption. Reconcile actual fees and do not promise a maker fill just to reduce the estimate. [S29, S30]

## Consistent demo fixture

| Item | Illustrative value |
|---|---|
| Maximum test entitlements | 40 |
| Conditional reward per entitlement | $20 |
| Required payout units | 800 contracts paying $1 |
| Assumed execution price | $0.40 |
| Acquisition cost | $320.00 |
| Formula fee at that price and aggregate quantity | $13.44 |
| Illustrative total | $333.44 |
| Merchant hard maximum debit | $350.00 |

Actual fill fragmentation and the exchange's rounding unit can change the total fee. The quote must distinguish an estimate from the conservative maximum debit. Reserve a mathematically justified fee ceiling based on permitted fill units and the execution price range. A casual slippage buffer is not proof of a hard cap.

For example, if the verified minimum fill unit is one contract and the buy limit is $0.41, principal is at most $328. A conservative per unit taker fee bound of two cents reserves $16, making that example's maximum $344. This bound is conditional on that fill granularity and fee policy. Different instrument increments require a new bound.

When all 40 rewards are owed under the winning outcome and 800 units are held, payout and gross rewards offset. Net promotion expense remains acquisition cost and fees. If only a few entitlements are claimed, unused coverage is a separate position and the equality no longer describes the actual campaign. Display it explicitly.

The UI never calls payout "profit." Show cash spent, conditional payout, committed rewards, unused capacity, and estimated residual exposure separately. For operational risks, show at least one loss without payout scenario and one payout without the assumed loss scenario. Do not add mutually exclusive payouts into a number labeled guaranteed protection.

# 14. Approval, authority, and invariants

The review card distinguishes **estimated debit** from **maximum authorized debit**. It includes the account and environment, event and outcome, quantity, limit price, fees, quote age, campaign terms, minimum acceptable funded capacity, and purchase expiry.

A click on **Approve and buy** authorizes only the displayed version. Save the user identity, merchant ID, plan ID, version, canonical hash, timestamp, maximum debit, and scope. The order service loads the stored approval. It does not accept arbitrary order details from the browser after the click.

Before submission, validate current market status, exact instrument, fresh depth, account balance, accepted terms, budget availability, risk limits, and the unchanged plan hash. Use a proposed five second maximum quote age and refresh at execution. Expired or materially changed conditions return the app to review rather than stretching the approval.

## Nonnegotiable invariants

1. No financial mutation occurs without a matching approval or explicitly configured allowance.
2. Actual spend plus conservative open order reservations never exceeds the approved budget.
3. Committed reward payout units plus pending claim holds never exceed confirmed allocated holdings.
4. One unit of payout cannot cover two independent obligations.
5. Unknown execution state blocks new commitments and retains financial reservations.
6. Pausing enrollment never retracts an existing entitlement or sells its reserved hedge.
7. A source, contract, or business figure that cannot be verified cannot become an asserted fact.
8. Replay events cannot alter the live research, sandbox account, or actual settlement ledger.

The default execution scope is a single purchase. An optional campaign allowance must name the instrument, total debit ceiling, price limit, maximum quantity, time window, and whether unused coverage may be sold. The first version does not automatically sell or rotate positions. Revoke stops future activity and cancels only safe unfilled orders; it does not erase existing positions or promises.

Terms acceptance is a separate human account consent, not something the agent silently performs because an example catches an `AcceptTermsRequired` error. Complete that setup before judging where possible. [S23]

# 15. Shared data model

The following are application types, not vendor API payloads.

```typescript
type TriggerKind = "sports_result" | "temperature" | "policy_event";
type MatchType = "exact" | "proxy" | "rejected" | "unknown";
type Provenance = "merchant" | "source" | "inference";

interface RiskSpec {
  id: string;
  merchantId: string;
  mode: "promotion" | "operational";
  exposureUsd: string;
  exposureBasis: string;
  triggerKind: TriggerKind;
  trigger: Record<string, unknown>;
  eventWindow: { startsAt: string; endsAt: string; timezone: string };
  budgetUsd: string;
  evidenceIds: string[];
}

interface ApprovedTradePlan {
  id: string;
  version: number;
  riskId: string;
  environment: "sandbox";
  instrumentSymbol: string;
  eventTicker: string;
  outcome: "yes" | "no";
  quantity: string;
  limitPrice: string;
  maxDebitUsd: string;
  matchType: MatchType;
  quoteId: string;
  rulesHash: string;
  expiresAt: string;
}
```

Production code replaces the generic trigger object with a Zod discriminated union. Sports requires game identity, team, period, overtime treatment, date, and cancellation behavior. Temperature requires station, metric, unit, threshold, comparison operator, observation window, and source. Policy requires an exact named action and date; unsupported policy verification keeps execution disabled.

| Entity | Core responsibility |
|---|---|
| merchants and memberships | Ownership, business context, access |
| runs and jobs | Durable orchestration and worker leases |
| evidence and artifacts | Retrieved facts, captures, provenance, private object paths |
| risks and contract_matches | Exposure and field by field compatibility |
| quotes and plans | Immutable calculation inputs and reviewed proposal |
| approvals and budget_reservations | Financial authority and reserved maximum costs |
| exchange_orders and fills | Provider IDs, execution state, quantities, actual fees |
| position_allocations | Map specific holdings to specific risk obligations |
| campaigns and entitlements | Customer eligibility and allocated payout units |
| run_events and outbox | Ordered UI updates and reliable side effects |
| monitors and settlement_records | Source changes and actual exchange reconciliation |

Use decimal strings across HTTP, numeric database columns for money, and string representations for large exchange IDs. Never allow a JavaScript JSON serialization failure on a BigInt order ID to make a successfully submitted trade look like an unsubmitted order. [S22, S25]

# 16. Internal API and event contracts

| Route | Behavior |
|---|---|
| `POST /api/runs` | Validate intent and create a research job; return 202 with run ID |
| `GET /api/runs/:id` | Return the authorized user's current persisted view |
| `GET /api/runs/:id/events?after=...` | Replay and stream ordered run events |
| `POST /api/plans/:id/revise` | Create a new immutable plan version |
| `POST /api/plans/:id/approve` | Authenticate, store approval, reserve funds, queue execution |
| `GET /api/risks/:id` | Read match, holdings, allocations, and monitoring |
| `POST /api/campaigns/:id/claims` | Atomically create a test entitlement within capacity |
| `POST /api/campaigns/:id/pause` | Stop new claims without disturbing existing allocations |
| `POST /api/webhooks/context` | Verify, deduplicate, and queue a source change |
| `POST /api/demo/:id/scenario` | Operate an isolated simulation namespace |

Every mutation accepts an application idempotency key. Uniqueness constraints enforce one approval execution and one entitlement per intended request. API responses use stable error codes such as `QUOTE_STALE`, `CAPACITY_EXHAUSTED`, `RULES_CHANGED`, and `EXECUTION_UNKNOWN`.

```typescript
interface RunEvent {
  id: string;
  runId: string;
  sequence: number;
  timestamp: string;
  type: string;
  provider: "context" | "gemini_markets" | "risk_engine" | "app";
  mode: "live_research" | "sandbox_exchange" | "simulation";
  title: string;
  artifactId?: string;
  sourceUrl?: string;
  providerRequestId?: string;
  payload: Record<string, unknown>;
}
```

Define a closed event vocabulary, including `tool.started`, `source.captured`, `evidence.added`, `match.rejected`, `quote.ready`, `approval.required`, `order.submitted`, `order.reconciled`, `capacity.changed`, and `run.failed`.

Persist before broadcasting. SSE reconnects use the last sequence and rebuild the view without rerunning tools. Send heartbeats, support cancellation of read work, and keep market ticks sampled for display instead of writing every tick into the narrative timeline. Never put credentials, full private pages, or sensitive internal account payloads in browser events.

# 17. Agent orchestration and state machine

Use one orchestrator with bounded tools. Separate domain logic through adapters, not several agents roleplaying a committee.

```text
DRAFT -> RESEARCHING -> MATCHING -> QUOTING -> AWAITING_APPROVAL
                                               |
                                               v
                                           APPROVED
                                               |
                                               v
                                SUBMITTING -> RECONCILING
                                               |
                               +---------------+---------------+
                               v               v               v
                            ACTIVE         NO_FILL      EXECUTION_UNKNOWN
                               |
                         MONITORING / PAUSED
                               |
                     SETTLEMENT_PENDING -> RECONCILED
```

The research stage can call `research_business`, `search_evidence`, `read_source`, `list_market_candidates`, and `inspect_contract`. These are application tools wrapping verified providers. `calculate_quote` is deterministic. `propose_plan` saves a draft. The research agent cannot call the exchange executor.

After approval, the execution service loads the plan and performs policy checks without asking the model whether to ignore a failed condition. Failed quotes return structured reasons that the agent can explain and use to propose a new plan.

Read retries are bounded with backoff and a research credit ceiling. Financial writes are not automatically retried. On process restart, recover pending jobs, connect account streams, reconcile actual positions and active orders, and only then resume new financial actions. Keep one mutation lane per sandbox account for this build.

# 18. Campaign claims and settlement

A test claim consumes a fixed $20 conditional entitlement. It is not a rough estimate based on an unbounded bar tab. Require the test cart to meet any stated qualification before the entitlement is committed.

In one database transaction, verify campaign state, cutoff, duplicate request status, and available allocated units. Lock the capacity row, reserve the units, create the entitlement, and commit an outbox event. Multiple simultaneous claims must not oversubscribe the final slot.

Do not call a language model or external research API in this transaction. A claim page can open on any phone, but the claim write goes through the server. Apply a per participant limit, rate limits, and an opaque campaign token. Do not expose merchant financial tables to anonymous clients.

Show **Test reward only. No real payment or credit.** on the customer page. Public research about a real venue must not imply that the venue endorsed or launched the generated campaign. Use a fictional venue for the published demo page, with clearly identified public research examples where necessary.

For real exchange settlement, consume the authenticated position stream and reconcile through settled positions. Gemini reports terminal settlement data through position updates rather than a separate settlement stream. An external article or an agent's reading of a score never overrides exchange settlement. [S25, S31]

Cancelled, invalid, disputed, or delayed events enter a specific state. Do not collapse them into NO. A normal terminal zero position is not a newly uncovered campaign if the payout has moved to the cash ledger. Preserve the settlement receipt and update the allocation's lifecycle.

The simulation module reads a saved plan and creates hypothetical payout and reward calculations. It cannot write provider fill records or send real refunds. Any future real refund integration is a separate ledger and payment service, with its own approval and reconciliation.

# 19. Security, reliability, and cost controls

Financial controls live outside the language model. Web content cannot change tool definitions, approvals, spend ceilings, or credential access. A quoted instruction in a scraped page remains evidence text, not a command.

Validate public URLs, protocols, redirects, and fetch destinations. Block private network targets, loopback addresses, embedded credentials, and arbitrary executable content. Sanitize rendered Markdown and treat external images as untrusted. Use a restrictive content security policy and private screenshot storage.

Use server side provider credentials and least privilege account access. Browser code receives only the Supabase publishable key where needed, never its secret key, Gemini secret, or Context key. Bind every resource lookup to merchant membership. Public claims have a narrow endpoint, not direct financial database access. [S10]

Revalidate market freshness after reconnection. A lost stream marks prices stale and disables buying. A missing screenshot does not block useful text research. A missing settlement rule does block an exact match purchase. Provider rate limits trigger visible backoff, not an infinite spinner or silent sample data substitution.

Keep three independent budgets: exchange spend, research credits, and infrastructure/model usage. The $350 hedge limit does not silently include unlimited research costs. Record credits, model tokens, provider latency, execution attempts, and error codes per run.

Marketing labels remain conservative: **conditional payout**, **matched trigger**, **partial offset**, **not executable**, and **needs review**. Do not label a proxy hedge fully insured. Production release requires independent financial, legal, eligibility, promotion, and operational review. Sandbox success does not prove permission to operate customer accounts or launch real prize promotions.

# 20. Implementation sequence and ownership

| Phase | Owner | Build | Exit gate |
|---|---|---|---|
| 0. Provider preflight | Execution engineer | Sandbox account, terms, inventory, depth, test fill; Context read and screenshot | Saved evidence of one successful sponsor request and reconciled test order |
| 1. Shared contracts | Backend and frontend | RiskSpec, RunEvent, plan schema, database migrations, replay fixtures | UI can render deterministic event fixtures; calculations pass |
| 2. Research workspace | Agent and frontend | Context tools, screenshots, evidence, candidate comparison | Actual source captures and rejected alternatives appear in the workspace |
| 3. Approval and executor | Execution engineer | Fresh quote, authority, funds reservation, one purchase, recovery | No order before approval; one approval cannot double submit |
| 4. Campaign loop | Backend and frontend | Customer page, QR code, atomic entitlements, pause | Concurrent claims cannot exceed allocated units |
| 5. Second risk adapter | Agent and backend | Temperature fields, station comparison, mismatch scenarios | The same pipeline produces a valid quote or an honest rejection |
| 6. Polish and rehearsal | Whole team | Motion, responsive behavior, replay labels, failure states | Full demo passes with normal and degraded provider behavior |

For two builders, combine backend and execution ownership, and combine frontend and agent presentation. Freeze interfaces before parallel work. Build the real financial adapter before adding decorative motion.

Suggested repository layout:

```text
apps/web/                  Next.js app and customer page
apps/service/              API, SSE, worker loop, provider connections
packages/domain/           Shared schemas and state transitions
packages/risk-engine/      Sizing, fee bounds, scenarios, compatibility
packages/provider-context/ Research and evidence adapter
packages/provider-gemini/  Inventory, books, orders, reconciliation
packages/ui/               Design tokens and shared components
supabase/                  Committed database migrations and policies
fixtures/                  Redacted provider samples and test scenarios
docs/                      PRD, decisions, API schema snapshots
```

Pin dependencies and commit the lockfile after testing compatible versions. Install the Context coding skill and optionally use Gemini's MCP server while developing. Neither replaces the application's actual SDK integrations. The Gemini repository provides SDK and MCP tooling; runtime trading should still pass through the policy controlled executor. [S13, S19, S32]

## Development configuration

Create `.env.example` with names only, never values or account secrets:

```dotenv
# Public browser configuration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Server only
CONTEXT_DEV_API_KEY=
GEMINI_API_KEY=
GEMINI_API_SECRET=
GEMINI_ENV=sandbox
ANTHROPIC_API_KEY=
AGENT_MODEL=
SUPABASE_SECRET_KEY=
DATABASE_URL=
DEMO_MODE=true
ALLOW_PRODUCTION_TRADING=false
```

`GEMINI_ENV`, `DEMO_MODE`, and `ALLOW_PRODUCTION_TRADING` are application settings, not claimed provider environment variable conventions. Map credentials into each SDK explicitly. A missing sandbox setting or enabled production trading flag must fail startup for this build.

Install and pin the chosen releases of `context.dev`, `@gemini-markets/sdk`, `ws`, `ai`, `@ai-sdk/anthropic`, `zod`, `decimal.js`, `fastify`, and the frontend libraries. Use a compatible supported Node release. Store secret credentials only in the persistent service's deployment environment.

The optional development skill setup is:

```bash
npx skills add https://docs.context.dev --skill context-dev --yes
```

A separate development credential does not become a frontend credential. Keep any MCP development permissions independent of runtime merchant approval. [S13, S32]

# 21. Acceptance tests and judging readiness

| Test | Required result |
|---|---|
| Unsupported or expired market | No executable plan, no fictional replacement |
| Different game period or weather station | Exact match rejected or explicitly downgraded to proxy |
| No financial exposure supplied | Inline request for input; no invented revenue |
| Scrape returns text but no screenshot | Reader fallback, not a fake browser capture |
| Stale quote or changed rules | Buy disabled or approval invalidated |
| Repeated approval click | One local execution intent |
| Submission timeout | Unknown state, reserved funds retained, no automatic resend |
| Immediate order ends canceled with fills | Confirmed quantity preserved and counted once |
| Partial fill | Only approved, confirmed capacity becomes available |
| Fee rounding across many fills | Conservative debit reservation remains within budget |
| Two customers claim last slot | One succeeds and one receives capacity exhausted |
| Same holding allocated twice | Database invariant rejects the second allocation |
| WebSocket reconnect | Account reconciles before buying resumes |
| Invalid or postponed event | Specific exception state, no assumed NO settlement |
| Malicious instructions in a source | No change to tools or financial authority |
| Replay outcome selected | Simulation only, no exchange or entitlement ledger mutation |
| Reduced motion | All statuses remain usable without animated movement |
| Cross merchant access attempt | Denied by service authorization and applicable row policy |

The preflight manifest records the selected event, real symbol, terms hash, environment, quote timestamp, observed depth, maximum safe quantity, provider request IDs, and the previously tested fill path. It is configuration, not fabricated market data.

Keep a clearly labeled recorded walkthrough for connectivity failure. Replays reuse the same UI event contracts but carry a persistent **Recorded run** badge and original timestamps. Never hide a provider failure by quietly switching to synthetic success.

Final completion means one real research to trade to claim flow, one second industry using the same engine, and an intelligible financial result. It does not mean a guaranteed prize or validated insurance business.

# 22. Launch checklist and open implementation gates

Before the demo, resolve exact sandbox instrument availability, settlement wording, account permissions, package versions, minimum fill increment, fee rounding behavior, and the actual depth required by the chosen quantity. The example $0.40 quote remains an illustrative fixture until a real book supplies it.

Confirm that screenshots and the optional monitor features work under the team's Context plan. Check the return shape of each enabled output and signed webhook behavior. Do not make paid browser actions or styleguide extraction a hidden requirement of the central demo.

Keep the first launch sandbox only. Political, tariff, and economic risk cards can demonstrate research and feasibility, but an unimplemented verifier must visibly block execution. The strongest proof of breadth is a functioning second workflow, not many generic insurance tiles.

**Final build decision** One assistant, one evidence workspace, one risk engine, one explicit purchase approval. The bar provides the memorable interaction. The contractor demonstrates generality. The receipts, limits, and honest exception states make the project credible.

# Source register

The following official documentation supports provider behavior and implementation details. Product requirements, layout, timings, internal schemas, limits, and build priorities are proposed design decisions.

- [S01] Grok Bot computer preview. https://docs.x.ai/grok-bot/computer-and-apps
- [S02] Next.js App Router. https://nextjs.org/docs/app
- [S03] shadcn/ui Next.js setup. https://ui.shadcn.com/docs/installation/next
- [S04] Motion for React. https://motion.dev/docs/react
- [S05] Context Scrape reference. https://docs.context.dev/api-reference/web-scraping/scrape
- [S06] Context Screenshot. https://docs.context.dev/scrape/screenshot
- [S07] Context Highlights guide and announcement. https://docs.context.dev/scrape/highlights ; https://www.context.dev/blog/introducing-context-highlights
- [S08] Context browser actions. https://docs.context.dev/scrape/browser-actions
- [S09] AI SDK tools. https://ai-sdk.dev/docs/foundations/tools
- [S10] Supabase row level security. https://supabase.com/docs/guides/database/postgres/row-level-security
- [S11] Supabase Data API exposure change. https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- [S12] Context introduction. https://docs.context.dev/introduction
- [S13] Context agent skill. https://docs.context.dev/install-skill
- [S14] Context Search guide. https://docs.context.dev/search/overview
- [S15] Context Brand API. https://docs.context.dev/api-reference/brand-intelligence/brand
- [S16] Context Styleguide API. https://docs.context.dev/api-reference/brand-intelligence/styleguide
- [S17] Context credits and pricing. https://docs.context.dev/account/credits
- [S18] Context monitors and webhooks. https://docs.context.dev/api-reference/monitors/create ; https://docs.context.dev/webhooks
- [S19] Gemini TypeScript quickstart. https://developer.gemini.com/tools/typescript-sdk/quickstart
- [S20] Gemini sandbox. https://developer.gemini.com/get-started/sandbox ; https://exchange.sandbox.gemini.com/
- [S21] Gemini SDK event discovery. https://developer.gemini.com/tools/typescript-sdk/reference/predictions/events-and-discovery
- [S22] Gemini SDK order management. https://developer.gemini.com/tools/typescript-sdk/reference/predictions/order-management
- [S23] Gemini SDK positions and terms. https://developer.gemini.com/tools/typescript-sdk/reference/predictions/positions-and-terms
- [S24] Gemini market discovery specification. https://developer.gemini.com/prediction-markets-spec/markets
- [S25] Gemini SDK WebSocket reference. https://developer.gemini.com/tools/typescript-sdk/reference/websocket
- [S26] Gemini prediction stream reference. https://developer.gemini.com/prediction-markets/websocket/streams
- [S27] Gemini order specification. https://developer.gemini.com/prediction-markets-spec/trading
- [S28] Gemini order lifecycle. https://developer.gemini.com/prediction-markets/order-lifecycle
- [S29] Gemini Predictions fee schedule. https://www.gemini.com/fees/predictions
- [S30] Gemini maker fee promotion. https://developer.gemini.com/prediction-markets/maker-fee-free-trading-promo
- [S31] Gemini positions specification. https://developer.gemini.com/prediction-markets-spec/positions
- [S32] Gemini developer platform repository. https://github.com/gemini/developer-platform
- [S33] Original Gemini entry link and current product overview. https://developer.gemini.com/prediction-markets/getting-started ; https://developer.gemini.com/products/prediction-markets
- [S34] Gemini API reference index. https://developer.gemini.com/prediction-markets-spec
- [S35] Context Answers. https://docs.context.dev/answers/overview
- [S36] AI SDK Anthropic provider. https://ai-sdk.dev/providers/ai-sdk-providers/anthropic
