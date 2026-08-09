-- Governed activity commands. Creation/assignment and their audit events happen
-- in one database transaction so successful business writes cannot lose audit provenance.

create table public.activity_code_sequences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reporting_year integer not null check (reporting_year between 2000 and 2200),
  last_value integer not null default 0 check (last_value >= 0),
  primary key (organization_id, reporting_year)
);

alter table public.activity_code_sequences enable row level security;
revoke all on public.activity_code_sequences from authenticated;

create or replace function public.current_role_has_permission(
  p_organization_id uuid,
  p_role_context text,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    join public.user_roles ur
      on ur.membership_id = m.id
     and ur.organization_id = m.organization_id
    join public.roles r on r.id = ur.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and r.code = p_role_context
      and p.code = p_permission_code
  );
$$;

revoke all on function public.current_role_has_permission(uuid,text,text) from public;
grant execute on function public.current_role_has_permission(uuid,text,text) to authenticated, service_role;

create or replace function public.create_activity_command(
  p_organization_id uuid,
  p_role_context text,
  p_title_ar text,
  p_title_en text,
  p_activity_type text,
  p_department_id uuid,
  p_planned_start_date date,
  p_planned_end_date date,
  p_delivery_method text,
  p_reporting_year integer
)
returns table (
  id uuid,
  activity_code text,
  organization_id uuid,
  title_ar text,
  title_en text,
  reporting_year integer,
  internal_state text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_sequence integer;
  v_code text;
  v_activity_id uuid;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='Authenticated user is required.';
  end if;

  if not public.current_role_has_permission(
    p_organization_id,
    p_role_context,
    'activity.create'
  ) then
    raise exception using errcode='42501', message='Active role context cannot create activities.';
  end if;

  if p_title_ar is null or length(btrim(p_title_ar)) < 3 then
    raise exception using errcode='22023', message='Arabic activity title is required.';
  end if;

  if p_reporting_year < 2000 or p_reporting_year > 2200 then
    raise exception using errcode='22023', message='Reporting year is invalid.';
  end if;

  if p_planned_start_date is not null
     and p_planned_end_date is not null
     and p_planned_end_date < p_planned_start_date then
    raise exception using errcode='22023', message='Planned end date cannot be before start date.';
  end if;

  -- Create the sequence row if it does not exist. Then lock/update it and advance
  -- from the greater of (a) its stored value and (b) any imported historical
  -- activity code already present for the organization/year.
  insert into public.activity_code_sequences(organization_id, reporting_year, last_value)
  values (p_organization_id, p_reporting_year, 0)
  on conflict on constraint activity_code_sequences_pkey do nothing;

  update public.activity_code_sequences s
  set last_value = greatest(
    s.last_value,
    coalesce((
      select max(substring(a.activity_code from '-([0-9]+)$')::integer)
      from public.activities a
      where a.organization_id = p_organization_id
        and a.reporting_year = p_reporting_year
        and substring(a.activity_code from '-([0-9]+)$') is not null
    ), 0)
  ) + 1
  where s.organization_id = p_organization_id
    and s.reporting_year = p_reporting_year
  returning s.last_value into v_sequence;

  v_code := 'CPD-' || p_reporting_year::text || '-' || lpad(v_sequence::text, 3, '0');

  insert into public.activities(
    organization_id,
    activity_code,
    title_ar,
    title_en,
    activity_type,
    department_id,
    planned_start_date,
    planned_end_date,
    delivery_method,
    reporting_year,
    internal_state,
    created_by
  ) values (
    p_organization_id,
    v_code,
    btrim(p_title_ar),
    nullif(btrim(p_title_en), ''),
    nullif(btrim(p_activity_type), ''),
    p_department_id,
    p_planned_start_date,
    p_planned_end_date,
    nullif(btrim(p_delivery_method), ''),
    p_reporting_year,
    'CREATED',
    v_actor
  ) returning public.activities.id into v_activity_id;

  insert into public.activity_status_history(
    organization_id,
    activity_id,
    from_state,
    to_state,
    changed_by,
    role_context,
    reason
  ) values (
    p_organization_id,
    v_activity_id,
    null,
    'CREATED',
    v_actor,
    p_role_context,
    'Activity created'
  );

  perform public.log_audit_event(
    p_organization_id,
    v_actor,
    p_role_context,
    'activity.created',
    'activity',
    v_activity_id,
    null,
    jsonb_build_object('activity_code', v_code, 'internal_state', 'CREATED'),
    null,
    null,
    null
  );

  return query
  select
    a.id,
    a.activity_code,
    a.organization_id,
    a.title_ar,
    a.title_en,
    a.reporting_year,
    a.internal_state
  from public.activities a
  where a.id = v_activity_id;
end;
$$;

revoke all on function public.create_activity_command(uuid,text,text,text,text,uuid,date,date,text,integer) from public;
grant execute on function public.create_activity_command(uuid,text,text,text,text,uuid,date,date,text,integer) to authenticated;

create or replace function public.assign_activity_officer_command(
  p_organization_id uuid,
  p_role_context text,
  p_activity_id uuid,
  p_membership_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_assignment_id uuid;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='Authenticated user is required.';
  end if;

  if not public.current_role_has_permission(
    p_organization_id,
    p_role_context,
    'activity.assign'
  ) then
    raise exception using errcode='42501', message='Active role context cannot assign activities.';
  end if;

  if not exists (
    select 1 from public.activities a
    where a.id = p_activity_id and a.organization_id = p_organization_id
  ) then
    raise exception using errcode='42501', message='Activity is not available in this organization.';
  end if;

  if not exists (
    select 1
    from public.organization_memberships m
    join public.user_roles ur
      on ur.membership_id = m.id
     and ur.organization_id = m.organization_id
    join public.roles r on r.id = ur.role_id
    where m.id = p_membership_id
      and m.organization_id = p_organization_id
      and m.status = 'ACTIVE'
      and r.code = 'ACTIVITY_OFFICER'
  ) then
    raise exception using errcode='42501', message='Selected membership is not an active Activity Officer in this organization.';
  end if;

  insert into public.activity_assignments(
    organization_id,
    activity_id,
    membership_id,
    assignment_role,
    is_active,
    assigned_by,
    assigned_at
  ) values (
    p_organization_id,
    p_activity_id,
    p_membership_id,
    'ACTIVITY_OFFICER',
    true,
    v_actor,
    now()
  )
  on conflict (activity_id, membership_id, assignment_role)
  do update set
    is_active = true,
    assigned_by = excluded.assigned_by,
    assigned_at = excluded.assigned_at
  returning id into v_assignment_id;

  perform public.log_audit_event(
    p_organization_id,
    v_actor,
    p_role_context,
    'activity.officer_assigned',
    'activity',
    p_activity_id,
    null,
    jsonb_build_object('membership_id', p_membership_id, 'assignment_id', v_assignment_id),
    null,
    null,
    null
  );

  return v_assignment_id;
end;
$$;

revoke all on function public.assign_activity_officer_command(uuid,text,uuid,uuid) from public;
grant execute on function public.assign_activity_officer_command(uuid,text,uuid,uuid) to authenticated;
