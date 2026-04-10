create extension if not exists pg_net;
create extension if not exists supabase_vault;

alter table public.analysis_runs
  drop constraint if exists analysis_runs_status_check;

update public.analysis_runs
set status = 'processing'
where status = 'leased';

alter table public.analysis_runs
  add column if not exists current_stage text not null default 'prepare';

alter table public.analysis_runs
  add constraint analysis_runs_status_check
  check (status in ('queued', 'processing', 'completed', 'failed', 'dead_letter'));

create table if not exists public.analysis_job_claims (
  msg_id bigint primary key,
  run_id uuid not null references public.analysis_runs(id) on delete cascade,
  stage text not null,
  claimed_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.analysis_run_tree_files (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.analysis_runs(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (run_id, path)
);

create table if not exists public.analysis_run_commits (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.analysis_runs(id) on delete cascade,
  commit_sha text not null,
  commit_sequence integer not null,
  committed_at timestamptz not null,
  batch_index integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (run_id, commit_sha),
  unique (run_id, commit_sequence)
);

create table if not exists public.analysis_run_commit_files (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.analysis_runs(id) on delete cascade,
  commit_sha text not null,
  commit_sequence integer not null,
  committed_at timestamptz not null,
  owner_key text not null,
  owner_login text,
  display_name text not null,
  filename text not null,
  additions integer not null,
  deletions integer not null,
  status text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (run_id, commit_sha, filename)
);

create table if not exists public.analysis_run_stage_state (
  run_id uuid primary key references public.analysis_runs(id) on delete cascade,
  next_batch_index integer not null default 0,
  batch_size integer not null default 25,
  tree_file_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists analysis_run_tree_files_run_id_idx
  on public.analysis_run_tree_files(run_id);

create index if not exists analysis_run_commits_run_id_batch_idx
  on public.analysis_run_commits(run_id, batch_index, commit_sequence);

create index if not exists analysis_run_commit_files_run_id_seq_idx
  on public.analysis_run_commit_files(run_id, commit_sequence);

drop trigger if exists analysis_run_stage_state_set_updated_at on public.analysis_run_stage_state;
create trigger analysis_run_stage_state_set_updated_at
before update on public.analysis_run_stage_state
for each row
execute function public.set_updated_at();

alter table public.analysis_job_claims enable row level security;
alter table public.analysis_run_tree_files enable row level security;
alter table public.analysis_run_commits enable row level security;
alter table public.analysis_run_commit_files enable row level security;
alter table public.analysis_run_stage_state enable row level security;

grant all privileges on public.analysis_job_claims to service_role;
grant all privileges on public.analysis_run_tree_files to service_role;
grant all privileges on public.analysis_run_commits to service_role;
grant all privileges on public.analysis_run_commit_files to service_role;
grant all privileges on public.analysis_run_stage_state to service_role;

alter table public.repository_processing_locks
  alter column worker_id drop not null;

create or replace function public.acquire_repository_run_lock(
  target_repository_id uuid,
  target_run_id uuid,
  lease_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_lease_time timestamptz := now();
  target_expiry timestamptz := current_lease_time + make_interval(secs => lease_seconds);
begin
  insert into public.repository_processing_locks (
    repository_id,
    run_id,
    lease_expires_at,
    updated_at
  )
  values (
    target_repository_id,
    target_run_id,
    target_expiry,
    current_lease_time
  )
  on conflict (repository_id) do update
  set
    run_id = excluded.run_id,
    lease_expires_at = excluded.lease_expires_at,
    updated_at = current_lease_time
  where public.repository_processing_locks.lease_expires_at <= current_lease_time
     or public.repository_processing_locks.run_id = target_run_id;

  return exists (
    select 1
    from public.repository_processing_locks
    where repository_id = target_repository_id
      and run_id = target_run_id
      and lease_expires_at > current_lease_time
  );
end;
$$;

create or replace function public.renew_repository_run_lock(
  target_repository_id uuid,
  target_run_id uuid,
  lease_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_lease_time timestamptz := now();
begin
  update public.repository_processing_locks
  set
    lease_expires_at = current_lease_time + make_interval(secs => lease_seconds),
    updated_at = current_lease_time
  where repository_id = target_repository_id
    and run_id = target_run_id;

  return found;
end;
$$;

create or replace function public.release_repository_run_lock(
  target_repository_id uuid,
  target_run_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.repository_processing_locks
  where repository_id = target_repository_id
    and run_id = target_run_id;

  return found;
end;
$$;

grant execute on function public.acquire_repository_run_lock(uuid, uuid, integer) to service_role;
grant execute on function public.renew_repository_run_lock(uuid, uuid, integer) to service_role;
grant execute on function public.release_repository_run_lock(uuid, uuid) to service_role;

create or replace function public.trigger_ownership_analysis_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, pgmq, net, vault
as $$
declare
  function_url text;
  webhook_secret text;
begin
  select decrypted_secret
  into function_url
  from vault.decrypted_secrets
  where name = 'ownership_analysis_webhook_url'
  limit 1;

  select decrypted_secret
  into webhook_secret
  from vault.decrypted_secrets
  where name = 'ownership_analysis_webhook_secret'
  limit 1;

  if function_url is null or webhook_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-ownership-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'schema', 'pgmq',
      'table', 'q_ownership_analysis',
      'record', jsonb_build_object(
        'msg_id', new.msg_id,
        'read_ct', new.read_ct,
        'enqueued_at', new.enqueued_at,
        'vt', new.vt,
        'message', new.message
      )
    )
  );

  return new;
end;
$$;

drop trigger if exists ownership_analysis_webhook_trigger on pgmq.q_ownership_analysis;
create trigger ownership_analysis_webhook_trigger
after insert on pgmq.q_ownership_analysis
for each row
execute function public.trigger_ownership_analysis_webhook();
