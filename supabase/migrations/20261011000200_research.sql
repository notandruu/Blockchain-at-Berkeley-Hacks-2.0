-- Evidence, captures, risks and contract matches.

create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  kind text not null check (kind in ('screenshot', 'markdown')),
  -- Private bucket path. The browser only ever gets a short-lived signed URL.
  storage_path text not null,
  mime text not null,
  sha256 text not null,
  bytes integer not null check (bytes > 0),
  created_at timestamptz not null default now()
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  requested_url text not null,
  final_url text not null,
  domain text not null,
  title text,
  objective text not null,
  capture_status text not null check (capture_status in ('screenshot', 'text_only', 'failed')),
  screenshot_artifact_id uuid references public.artifacts(id),
  markdown_excerpt text,
  context_request_id text,
  cache_status text,
  cache_age_ms bigint,
  source_published_at timestamptz,
  retrieved_at timestamptz not null default now()
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  source_id uuid references public.sources(id) on delete cascade,
  -- Observed fact (from a retrieved source), merchant supplied, or agent inference.
  provenance text not null check (provenance in ('source', 'merchant', 'inference')),
  claim text not null,
  passage text,
  query text,
  created_at timestamptz not null default now(),
  -- An observed fact must point at the source that supports it.
  check (provenance <> 'source' or (source_id is not null and passage is not null))
);

create table public.risks (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  run_id uuid not null references public.runs(id) on delete cascade,
  mode text not null check (mode in ('promotion', 'operational')),
  title text not null,
  spec jsonb not null,
  status text not null default 'proposed' check (status in ('proposed', 'active', 'research_only', 'closed')),
  created_at timestamptz not null default now()
);

create table public.contract_matches (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  risk_id uuid references public.risks(id) on delete cascade,
  environment text not null check (environment in ('sandbox', 'production')),
  event_ticker text not null,
  instrument_symbol text not null,
  label text not null,
  match_type text not null check (match_type in ('exact', 'proxy', 'rejected', 'unknown')),
  executable boolean not null,
  outcome text check (outcome in ('yes', 'no')),
  checks jsonb not null,
  rejections text[] not null default '{}',
  caveats text[] not null default '{}',
  rules_hash text not null,
  candidate jsonb not null,
  created_at timestamptz not null default now(),
  unique (run_id, instrument_symbol)
);
