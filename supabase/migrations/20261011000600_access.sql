-- Access model.
-- The service connects as the database owner and enforces merchant membership itself on
-- every request. These policies are the second wall: if a browser ever talks to the Data
-- API directly with a user token, it can read only its own merchants' rows and write
-- nothing. Anonymous users get nothing; public claims go through the service endpoint.

create or replace function public.is_member(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where merchant_id = m and user_id = auth.uid());
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'merchants', 'memberships', 'runs', 'run_events', 'jobs', 'outbox', 'provider_calls',
    'artifacts', 'sources', 'evidence', 'risks', 'contract_matches', 'quotes', 'plans',
    'exchange_accounts', 'approvals', 'budget_reservations', 'exchange_orders', 'fills',
    'holdings', 'settlement_records', 'campaigns', 'entitlements', 'position_allocations',
    'monitors', 'webhook_events', 'simulations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Explicit read grants for the authenticated role (new tables are not exposed by default).
grant select on public.merchants, public.memberships, public.runs, public.run_events,
  public.sources, public.evidence, public.risks, public.contract_matches, public.plans,
  public.approvals, public.exchange_orders, public.holdings, public.campaigns
  to authenticated;

create policy merchants_read on public.merchants for select to authenticated using (public.is_member(id));
create policy memberships_read on public.memberships for select to authenticated using (user_id = auth.uid());
create policy runs_read on public.runs for select to authenticated using (public.is_member(merchant_id));
create policy run_events_read on public.run_events for select to authenticated
  using (exists (select 1 from public.runs r where r.id = run_id and public.is_member(r.merchant_id)));
create policy sources_read on public.sources for select to authenticated
  using (exists (select 1 from public.runs r where r.id = run_id and public.is_member(r.merchant_id)));
create policy evidence_read on public.evidence for select to authenticated
  using (exists (select 1 from public.runs r where r.id = run_id and public.is_member(r.merchant_id)));
create policy risks_read on public.risks for select to authenticated using (public.is_member(merchant_id));
create policy matches_read on public.contract_matches for select to authenticated
  using (exists (select 1 from public.runs r where r.id = run_id and public.is_member(r.merchant_id)));
create policy plans_read on public.plans for select to authenticated
  using (exists (select 1 from public.runs r where r.id = run_id and public.is_member(r.merchant_id)));
create policy approvals_read on public.approvals for select to authenticated using (public.is_member(merchant_id));
create policy orders_read on public.exchange_orders for select to authenticated
  using (exists (select 1 from public.plans p join public.runs r on r.id = p.run_id where p.id = plan_id and public.is_member(r.merchant_id)));
create policy holdings_read on public.holdings for select to authenticated
  using (exists (select 1 from public.risks k where k.id = risk_id and public.is_member(k.merchant_id)));
create policy campaigns_read on public.campaigns for select to authenticated using (public.is_member(merchant_id));

-- Private bucket for page captures. No public read; the service signs short-lived URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('captures', 'captures', false, 8388608, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
