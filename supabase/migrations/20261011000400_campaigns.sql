-- Campaigns, entitlements and the atomic claim.

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  risk_id uuid not null references public.risks(id),
  plan_id uuid not null references public.plans(id),
  holding_id uuid references public.holdings(id),
  slug text not null unique,
  -- Opaque token in the QR code. The slug alone is not enough to claim.
  public_token text not null default encode(extensions.gen_random_bytes(18), 'base64'),
  venue_name text not null,
  headline text not null,
  qualification text not null,
  reward_usd numeric(10, 2) not null check (reward_usd > 0),
  max_entitlements integer not null check (max_entitlements >= 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'closed')),
  paused_reason text,
  closes_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  participant_key text not null,
  idempotency_key text not null unique,
  units numeric(18, 4) not null check (units > 0),
  voucher_code text not null unique default upper(encode(extensions.gen_random_bytes(5), 'hex')),
  status text not null default 'active' check (status in ('active', 'void')),
  created_at timestamptz not null default now(),
  -- one test reward per participant per campaign
  unique (campaign_id, participant_key)
);

create table public.position_allocations (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid not null references public.holdings(id),
  -- Invariant 4: one entitlement is covered by exactly one allocation.
  entitlement_id uuid not null unique references public.entitlements(id),
  units numeric(18, 4) not null check (units > 0),
  created_at timestamptz not null default now()
);

-- The whole claim in one transaction: lock the campaign and its holding, check state,
-- cutoff, duplicates and capacity, then commit entitlement + allocation + outbox together.
-- No model call and no external API inside this function.
create or replace function public.claim_entitlement(p_campaign_id uuid, p_token text, p_participant text, p_idempotency_key text)
returns table (result text, entitlement_id uuid, voucher_code text, remaining integer)
language plpgsql as $$
declare
  c public.campaigns%rowtype;
  h public.holdings%rowtype;
  e public.entitlements%rowtype;
  units numeric;
  free_units numeric;
begin
  select * into e from public.entitlements where idempotency_key = p_idempotency_key;
  if found then
    select * into h from public.holdings where id = (select holding_id from public.campaigns where id = e.campaign_id);
    return query select 'ok'::text, e.id, e.voucher_code, floor((h.confirmed_units - h.allocated_units - h.held_units) / (select reward_usd from public.campaigns where id = e.campaign_id))::integer;
    return;
  end if;

  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found or c.public_token <> p_token then
    return query select 'NOT_FOUND'::text, null::uuid, null::text, 0; return;
  end if;
  if c.status <> 'active' or c.holding_id is null then
    return query select 'CAMPAIGN_CLOSED'::text, null::uuid, null::text, 0; return;
  end if;
  if now() >= c.closes_at then
    return query select 'CAMPAIGN_CLOSED'::text, null::uuid, null::text, 0; return;
  end if;
  if exists (select 1 from public.entitlements where campaign_id = c.id and participant_key = p_participant) then
    return query select 'DUPLICATE_CLAIM'::text, null::uuid, null::text, 0; return;
  end if;

  select * into h from public.holdings where id = c.holding_id for update;
  units := c.reward_usd;  -- a $1-paying contract: one unit per reward dollar
  free_units := h.confirmed_units - h.allocated_units - h.held_units;
  if free_units < units then
    return query select 'CAPACITY_EXHAUSTED'::text, null::uuid, null::text, 0; return;
  end if;

  update public.holdings set allocated_units = allocated_units + units, updated_at = now() where id = h.id;
  insert into public.entitlements (campaign_id, participant_key, idempotency_key, units)
    values (c.id, p_participant, p_idempotency_key, units) returning * into e;
  insert into public.position_allocations (holding_id, entitlement_id, units) values (h.id, e.id, units);
  insert into public.outbox (topic, aggregate_id, payload)
    values ('capacity.changed', c.id, jsonb_build_object('campaignId', c.id, 'entitlementId', e.id, 'remaining', floor((free_units - units) / c.reward_usd)));

  return query select 'ok'::text, e.id, e.voucher_code, floor((free_units - units) / c.reward_usd)::integer;
end $$;

-- Pausing stops new claims and never touches existing entitlements or the hedge (invariant 6).
create or replace function public.pause_campaign(p_campaign_id uuid, p_reason text)
returns void language sql as $$
  update public.campaigns set status = 'paused', paused_reason = p_reason where id = p_campaign_id and status = 'active';
  insert into public.outbox (topic, aggregate_id, payload) values ('campaign.paused', p_campaign_id, jsonb_build_object('reason', p_reason));
$$;
