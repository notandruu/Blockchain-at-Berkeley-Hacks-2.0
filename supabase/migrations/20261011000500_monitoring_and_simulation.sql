-- Source monitors, webhook dedupe and the isolated simulation namespace.

create table public.monitors (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  context_monitor_id text not null unique,
  url text not null,
  webhook_secret text,
  status text not null default 'active' check (status in ('active', 'stopped')),
  created_at timestamptz not null default now()
);

-- X-Context-Id is the stable dedupe key across retries and replays.
create table public.webhook_events (
  id text primary key,
  provider text not null default 'context',
  event_type text,
  monitor_id uuid references public.monitors(id),
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Simulations read a saved plan and write only here. They have no foreign key into orders,
-- fills, holdings or entitlements, so a replay cannot touch the real ledger (invariant 8).
create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  scenario text not null,
  inputs jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
