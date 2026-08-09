-- Preserve assignment history while enforcing exactly one active Activity Officer
-- per activity. Reassignment deactivates the previous officer in the same atomic
-- governed command before activating the new one.

create unique index if not exists activity_assignments_one_active_officer_idx
  on public.activity_assignments(activity_id)
  where assignment_role = 'ACTIVITY_OFFICER' and is_active = true;

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
  v_previous_membership_id uuid;
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
    select 1
    from public.activities a
    where a.id = p_activity_id
      and a.organization_id = p_organization_id
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

  -- Serialize assignment changes for this activity to prevent two concurrent
  -- requests from producing two active officers.
  perform pg_advisory_xact_lock(hashtextextended(p_activity_id::text, 0));

  select aa.membership_id
    into v_previous_membership_id
  from public.activity_assignments aa
  where aa.activity_id = p_activity_id
    and aa.organization_id = p_organization_id
    and aa.assignment_role = 'ACTIVITY_OFFICER'
    and aa.is_active = true
  limit 1;

  update public.activity_assignments aa
  set is_active = false
  where aa.activity_id = p_activity_id
    and aa.organization_id = p_organization_id
    and aa.assignment_role = 'ACTIVITY_OFFICER'
    and aa.is_active = true
    and aa.membership_id <> p_membership_id;

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
    jsonb_build_object(
      'membership_id', p_membership_id,
      'previous_membership_id', v_previous_membership_id,
      'assignment_id', v_assignment_id
    ),
    null,
    null,
    null
  );

  return v_assignment_id;
end;
$$;

revoke all on function public.assign_activity_officer_command(uuid,text,uuid,uuid) from public;
grant execute on function public.assign_activity_officer_command(uuid,text,uuid,uuid) to authenticated;
