-- Quotes, versioned plans, approvals, reservations, orders, fills and holdings.
-- The PRD's financial invariants are enforced here as constraints, so a bug in the service
-- produces a failed transaction instead of a wrong ledger.

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  instrument_symbol text not null,
  environment text not null check (environment = 'sandbox'),
  outcome text not null check (outcome in ('yes', 'no')),
  depth jsonb not null,
  body jsonb not null,
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Plans are immutable. Editing creates a new version; the old row becomes 'superseded'.
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  plan_group_id uuid not null,
  version integer not null check (version > 0),
  run_id uuid not null references public.runs(id) on delete cascade,
  risk_id uuid not null references public.risks(id) on delete cascade,
  quote_id uuid not null references public.quotes(id),
  body jsonb not null,
  plan_hash text not null,
  max_debit_usd numeric(14, 2) not null check (max_debit_usd >= 0),
  status text not null default 'proposed' check (status in ('proposed', 'superseded', 'approved', 'executed', 'expired', 'invalidated')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (plan_group_id, version)
);

create or replace function public.plans_body_immutable() returns trigger language plpgsql as $$
begin
  if new.body is distinct from old.body or new.plan_hash is distinct from old.plan_hash or new.max_debit_usd is distinct from old.max_debit_usd then
    raise exception 'plans are immutable; create a new version' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger plans_body_immutable before update on public.plans for each row execute function public.plans_body_immutable();

-- One sandbox account, one mutation lane. An unknown execution blocks new commitments
-- until reconciliation clears it (invariant 5).
create table public.exchange_accounts (
  id text primary key,
  environment text not null check (environment = 'sandbox'),
  blocked_by_order_id uuid,
  blocked_reason text,
  updated_at timestamptz not null default now()
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null unique references public.plans(id),
  merchant_id uuid not null references public.merchants(id),
  user_id uuid not null references auth.users(id),
  plan_version integer not null,
  plan_hash text not null,
  max_debit_usd numeric(14, 2) not null check (max_debit_usd > 0),
  scope text not null default 'single_purchase' check (scope in ('single_purchase')),
  idempotency_key text not null unique,
  approved_at timestamptz not null default now()
);

create table public.budget_reservations (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null unique references public.approvals(id),
  merchant_id uuid not null references public.merchants(id),
  reserved_usd numeric(14, 2) not null check (reserved_usd >= 0),
  spent_usd numeric(14, 2) not null default 0 check (spent_usd >= 0),
  status text not null default 'held' check (status in ('held', 'consumed', 'released')),
  updated_at timestamptz not null default now(),
  -- Invariant 2: actual spend never exceeds the conservative reservation.
  check (spent_usd <= reserved_usd)
);

create or replace function public.reservation_within_approval() returns trigger language plpgsql as $$
declare cap numeric;
begin
  select max_debit_usd into cap from public.approvals where id = new.approval_id;
  if new.reserved_usd > cap then
    raise exception 'reservation % exceeds approved maximum %', new.reserved_usd, cap using errcode = 'P0002';
  end if;
  return new;
end $$;
create trigger reservation_within_approval before insert or update on public.budget_reservations for each row execute function public.reservation_within_approval();

create table public.exchange_orders (
  id uuid primary key default gen_random_uuid(),
  -- Invariant 1 and "repeated approval click": one execution intent per approval.
  approval_id uuid not null unique references public.approvals(id),
  plan_id uuid not null references public.plans(id),
  account_id text not null references public.exchange_accounts(id),
  environment text not null check (environment = 'sandbox'),
  symbol text not null,
  outcome text not null check (outcome in ('yes', 'no')),
  quantity numeric(18, 4) not null check (quantity > 0),
  limit_price numeric(6, 4) not null check (limit_price > 0 and limit_price < 1),
  time_in_force text not null check (time_in_force in ('fill-or-kill', 'immediate-or-cancel')),
  state text not null default 'pending' check (state in ('pending', 'submitting', 'accepted', 'rejected', 'unknown', 'reconciled')),
  -- 64-bit exchange ids stored as text, never as a JS number.
  exchange_order_id text unique,
  exchange_status text,
  reject_code text,
  reject_message text,
  filled_quantity numeric(18, 4) not null default 0 check (filled_quantity >= 0),
  avg_price numeric(10, 6),
  principal_usd numeric(14, 4) not null default 0,
  fees_usd numeric(14, 4) not null default 0,
  fees_source text check (fees_source in ('stream', 'formula')),
  submitted_at timestamptz,
  reconciled_at timestamptz,
  response jsonb,
  created_at timestamptz not null default now(),
  check (filled_quantity <= quantity)
);

create table public.fills (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.exchange_orders(id) on delete cascade,
  trade_id text not null,
  quantity numeric(18, 4) not null check (quantity > 0),
  price numeric(10, 6) not null,
  fee_usd numeric(14, 4),
  maker boolean,
  source text not null check (source in ('stream', 'rest')),
  created_at timestamptz not null default now(),
  unique (order_id, trade_id)
);

-- Confirmed payout units for one order and how much of it is promised away.
-- Invariant 3: allocated + pending holds <= confirmed. Invariant 4 follows from each
-- allocation row consuming units from exactly one holding.
create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.exchange_orders(id),
  risk_id uuid not null references public.risks(id),
  symbol text not null,
  outcome text not null check (outcome in ('yes', 'no')),
  confirmed_units numeric(18, 4) not null default 0 check (confirmed_units >= 0),
  allocated_units numeric(18, 4) not null default 0 check (allocated_units >= 0),
  held_units numeric(18, 4) not null default 0 check (held_units >= 0),
  lifecycle text not null default 'open' check (lifecycle in ('open', 'settlement_pending', 'settled', 'exception')),
  updated_at timestamptz not null default now(),
  constraint holdings_no_oversubscription check (allocated_units + held_units <= confirmed_units)
);

create table public.settlement_records (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid not null references public.holdings(id),
  resolution_side text check (resolution_side in ('yes', 'no', 'unspecified')),
  payout_usd numeric(14, 4) not null,
  -- Cancelled, disputed or delayed events are their own state, never collapsed into NO.
  state text not null check (state in ('settled', 'cancelled', 'disputed', 'delayed')),
  settled_at timestamptz,
  raw jsonb not null,
  created_at timestamptz not null default now()
);
