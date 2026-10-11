-- Core tenancy, runs, durable jobs and the ordered event log.

create extension if not exists pgcrypto;

create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (merchant_id, user_id)
);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  goal text not null,
  business_url text,
  inputs jsonb not null default '{}'::jsonb,
  state text not null default 'DRAFT',
  -- live: real providers. recorded: a replay of a past run, always badged in the UI.
  mode text not null default 'live' check (mode in ('live', 'recorded')),
  research_credits_used integer not null default 0,
  research_credit_ceiling integer not null,
  model_input_tokens integer not null default 0,
  model_output_tokens integer not null default 0,
  error_code text,
  error_message text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index runs_merchant_idx on public.runs (merchant_id, created_at desc);

-- Persist before broadcasting: SSE replays from here using (run_id, sequence).
create table public.run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  sequence integer not null,
  ts timestamptz not null default now(),
  type text not null,
  provider text not null check (provider in ('context', 'gemini_markets', 'risk_engine', 'app', 'agent')),
  mode text not null check (mode in ('live_research', 'sandbox_exchange', 'simulation', 'recorded')),
  title text not null,
  artifact_id uuid,
  source_url text,
  provider_request_id text,
  payload jsonb not null default '{}'::jsonb,
  unique (run_id, sequence)
);

-- Postgres job queue with leases. Workers claim with FOR UPDATE SKIP LOCKED; an expired
-- lease makes the job claimable again after a crash.
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  run_id uuid references public.runs(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'leased', 'done', 'failed', 'cancelled')),
  -- Financial jobs run on one lane per sandbox account so two can never interleave.
  lane text not null default 'research',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  lease_owner text,
  lease_expires_at timestamptz,
  run_after timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_claim_idx on public.jobs (lane, status, run_after);

-- Reliable side effects (SSE fan-out of commits made inside other transactions).
create table public.outbox (
  id bigserial primary key,
  topic text not null,
  aggregate_id uuid,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index outbox_unpublished_idx on public.outbox (id) where published_at is null;

-- Every external request, for cost and latency accounting per run.
create table public.provider_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.runs(id) on delete cascade,
  provider text not null,
  operation text not null,
  request_id text,
  status text not null check (status in ('ok', 'partial', 'error')),
  credits numeric(12, 2) not null default 0,
  latency_ms integer,
  error_code text,
  created_at timestamptz not null default now()
);
