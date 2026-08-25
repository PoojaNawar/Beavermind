-- Call evaluations
create table if not exists evaluations (
  id uuid primary key default gen_random_uuid(),
  call_type text not null check (call_type in ('kickoff', 'coaching')),
  transcript text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  result jsonb,
  error_message text,
  rubric_version text not null,
  model_name text,
  processing_started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists evaluations_status_idx on evaluations (status);
create index if not exists evaluations_created_at_idx on evaluations (created_at desc);

-- Auto-update updated_at
create or replace function set_evaluations_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists evaluations_updated_at on evaluations;
create trigger evaluations_updated_at
  before update on evaluations
  for each row execute function set_evaluations_updated_at();

-- Open read/write for the service role; anon can read completed evaluations if desired.
-- For this MVP the API uses the service role exclusively.
alter table evaluations enable row level security;

create policy "service role full access"
  on evaluations
  for all
  using (true)
  with check (true);
