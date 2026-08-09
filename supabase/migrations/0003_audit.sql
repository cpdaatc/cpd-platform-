create extension if not exists pgcrypto;

create table public.audit_logs (
  event_sequence bigserial primary key,
  event_id uuid not null unique default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  user_id uuid references public.users(id),
  role_context text not null,
  action text not null,
  entity_type text,
  entity_id uuid,
  before_json jsonb,
  after_json jsonb,
  ip_address inet,
  user_agent text,
  request_id text,
  occurred_at timestamptz not null default now(),
  previous_hash text,
  event_hash text not null default ''
);

create index audit_logs_org_sequence_idx
  on public.audit_logs(organization_id, event_sequence);
create index audit_logs_entity_idx
  on public.audit_logs(entity_type, entity_id, event_sequence desc);
create index audit_logs_user_idx
  on public.audit_logs(user_id, event_sequence desc);

create table public.audit_hash_anchors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  event_sequence bigint not null,
  event_hash text not null,
  anchor_target text,
  anchor_reference text,
  anchored_at timestamptz not null default now()
);

create or replace function public.audit_compute_hash(
  p_previous_hash text,
  p_event_id uuid,
  p_organization_id uuid,
  p_user_id uuid,
  p_role_context text,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before_json jsonb,
  p_after_json jsonb,
  p_ip_address inet,
  p_user_agent text,
  p_request_id text,
  p_occurred_at timestamptz
)
returns text
language sql
immutable
as $$
  select encode(
    digest(
      convert_to(
        concat_ws(chr(31),
          coalesce(p_previous_hash, ''),
          coalesce(p_event_id::text, ''),
          coalesce(p_organization_id::text, ''),
          coalesce(p_user_id::text, ''),
          coalesce(p_role_context, ''),
          coalesce(p_action, ''),
          coalesce(p_entity_type, ''),
          coalesce(p_entity_id::text, ''),
          coalesce(p_before_json::text, ''),
          coalesce(p_after_json::text, ''),
          coalesce(p_ip_address::text, ''),
          coalesce(p_user_agent, ''),
          coalesce(p_request_id, ''),
          coalesce(extract(epoch from p_occurred_at)::numeric::text, '')
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.audit_logs_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_hash text;
begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.organization_id::text, 'GLOBAL'), 0));

  select a.event_hash
    into v_previous_hash
  from public.audit_logs a
  where a.organization_id is not distinct from new.organization_id
  order by a.event_sequence desc
  limit 1;

  new.previous_hash := v_previous_hash;
  new.event_hash := public.audit_compute_hash(
    v_previous_hash,
    new.event_id,
    new.organization_id,
    new.user_id,
    new.role_context,
    new.action,
    new.entity_type,
    new.entity_id,
    new.before_json,
    new.after_json,
    new.ip_address,
    new.user_agent,
    new.request_id,
    new.occurred_at
  );

  return new;
end;
$$;

create trigger audit_logs_hash_before_insert
before insert on public.audit_logs
for each row execute function public.audit_logs_before_insert();

create or replace function public.audit_logs_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit log is append-only';
end;
$$;

create trigger audit_logs_immutable_guard
before update or delete on public.audit_logs
for each row execute function public.audit_logs_reject_mutation();

create or replace function public.log_audit_event(
  p_organization_id uuid,
  p_user_id uuid,
  p_role_context text,
  p_action text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_before_json jsonb default null,
  p_after_json jsonb default null,
  p_ip_address inet default null,
  p_user_agent text default null,
  p_request_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  insert into public.audit_logs(
    organization_id,
    user_id,
    role_context,
    action,
    entity_type,
    entity_id,
    before_json,
    after_json,
    ip_address,
    user_agent,
    request_id
  ) values (
    p_organization_id,
    p_user_id,
    p_role_context,
    p_action,
    p_entity_type,
    p_entity_id,
    p_before_json,
    p_after_json,
    p_ip_address,
    p_user_agent,
    p_request_id
  )
  returning event_id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.verify_audit_chain(p_organization_id uuid)
returns table (
  event_sequence bigint,
  event_id uuid,
  ok boolean,
  expected_previous_hash text,
  stored_previous_hash text,
  expected_event_hash text,
  stored_event_hash text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.audit_logs%rowtype;
  v_previous_hash text := null;
  v_expected_hash text;
begin
  for r in
    select *
    from public.audit_logs
    where organization_id is not distinct from p_organization_id
    order by event_sequence
  loop
    v_expected_hash := public.audit_compute_hash(
      v_previous_hash,
      r.event_id,
      r.organization_id,
      r.user_id,
      r.role_context,
      r.action,
      r.entity_type,
      r.entity_id,
      r.before_json,
      r.after_json,
      r.ip_address,
      r.user_agent,
      r.request_id,
      r.occurred_at
    );

    event_sequence := r.event_sequence;
    event_id := r.event_id;
    expected_previous_hash := v_previous_hash;
    stored_previous_hash := r.previous_hash;
    expected_event_hash := v_expected_hash;
    stored_event_hash := r.event_hash;
    ok := (r.previous_hash is not distinct from v_previous_hash) and r.event_hash = v_expected_hash;
    return next;

    v_previous_hash := r.event_hash;
  end loop;
end;
$$;
