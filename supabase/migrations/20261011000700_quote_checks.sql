-- Latest freshness check of a proposed plan against the live book. Kept outside the
-- immutable plan body: it changes every few seconds while the merchant reads the plan.
alter table public.plans add column last_quote_check jsonb;

create or replace function public.plans_body_immutable() returns trigger language plpgsql as $$
begin
  if new.body is distinct from old.body or new.plan_hash is distinct from old.plan_hash
     or new.max_debit_usd is distinct from old.max_debit_usd or new.version is distinct from old.version then
    raise exception 'plans are immutable; create a new version' using errcode = 'P0001';
  end if;
  return new;
end $$;

insert into public.exchange_accounts (id, environment) values ('sandbox-primary', 'sandbox') on conflict do nothing;
