-- Production-readiness correction: follow-up policy versions must be selectable
-- by the activity conduct date, including historical SUPERSEDED versions.

create or replace function public.configure_impact_followup_policy_version_command(
  p_organization_id uuid,
  p_role_context text,
  p_name text,
  p_version text,
  p_effective_from date,
  p_effective_to date,
  p_levels jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_id uuid;
  v jsonb;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'methodology.configure') then
    raise exception using errcode='42501',message='Not authorized to configure follow-up policy';
  end if;
  if p_effective_from is null then
    raise exception using errcode='22023',message='Policy effective_from is required';
  end if;
  if p_effective_to is not null and p_effective_to<p_effective_from then
    raise exception using errcode='22023',message='Policy effective_to cannot precede effective_from';
  end if;
  if jsonb_array_length(coalesce(p_levels,'[]'::jsonb))<>4 then
    raise exception using errcode='22023',message='L1-L4 policy levels are required';
  end if;

  insert into public.impact_followup_policies(
    organization_id,name,version_label,status,effective_from,effective_to,configured_by
  ) values(
    p_organization_id,p_name,p_version,'DRAFT',p_effective_from,p_effective_to,v_actor
  ) returning id into v_id;

  for v in select * from jsonb_array_elements(p_levels) loop
    insert into public.impact_followup_policy_levels(
      organization_id,policy_id,level,due_offset_days,grace_period_days,required
    ) values(
      p_organization_id,v_id,v->>'level',(v->>'dueOffsetDays')::int,
      coalesce((v->>'gracePeriodDays')::int,0),coalesce((v->>'required')::boolean,true)
    );
  end loop;

  perform public.log_audit_event(
    p_organization_id,v_actor,p_role_context,'impact.followup_policy_configured',
    'impact_followup_policy',v_id,null,
    jsonb_build_object('version',p_version,'effective_from',p_effective_from,'effective_to',p_effective_to),
    null,null,null
  );
  return v_id;
end $$;
revoke all on function public.configure_impact_followup_policy_version_command(uuid,text,text,text,date,date,jsonb) from public;
grant execute on function public.configure_impact_followup_policy_version_command(uuid,text,text,text,date,date,jsonb) to authenticated;

create or replace function public.approve_impact_followup_policy_command(
  p_organization_id uuid,p_role_context text,p_policy_id uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_new_from date;
  v_current_id uuid;
  v_current_from date;
  v_current_to date;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'methodology.approve') then
    raise exception using errcode='42501',message='Management approval is required';
  end if;

  select effective_from into v_new_from
  from public.impact_followup_policies
  where id=p_policy_id and organization_id=p_organization_id and status='DRAFT'
  for update;
  if v_new_from is null then
    raise exception using errcode='22023',message='Draft follow-up policy with effective_from is required';
  end if;

  select id,effective_from,effective_to into v_current_id,v_current_from,v_current_to
  from public.impact_followup_policies
  where organization_id=p_organization_id and status='ACTIVE' and id<>p_policy_id
  for update;

  if v_current_id is not null then
    if v_current_from is not null and v_new_from<=v_current_from then
      raise exception using errcode='22023',message='New policy effective_from must be after the current active policy start';
    end if;
    update public.impact_followup_policies
    set status='SUPERSEDED',
        effective_to=case
          when effective_to is null or effective_to>=v_new_from then v_new_from-1
          else effective_to
        end
    where id=v_current_id;
  end if;

  update public.impact_followup_policies
  set status='ACTIVE',approved_by=v_actor,approved_at=now()
  where id=p_policy_id and organization_id=p_organization_id and status='DRAFT';
  if not found then
    raise exception using errcode='22023',message='Draft follow-up policy not found';
  end if;

  perform public.log_audit_event(
    p_organization_id,v_actor,p_role_context,'impact.followup_policy_approved',
    'impact_followup_policy',p_policy_id,null,
    jsonb_build_object('effective_from',v_new_from,'superseded_policy_id',v_current_id),
    null,null,null
  );
end $$;
revoke all on function public.approve_impact_followup_policy_command(uuid,text,uuid) from public;
grant execute on function public.approve_impact_followup_policy_command(uuid,text,uuid) to authenticated;

create or replace function public.mark_activity_conducted_command(
  p_organization_id uuid,p_role_context text,p_activity_id uuid,p_conducted_at timestamptz
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_policy uuid;
  v_level record;
  v_state text;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'impact.manage') then
    raise exception using errcode='42501',message='Not authorized to manage impact';
  end if;
  if p_role_context='ACTIVITY_OFFICER' and not public.current_user_is_assigned_activity(p_activity_id) then
    raise exception using errcode='42501',message='Activity Officer is not assigned';
  end if;
  if not exists(
    select 1 from public.external_submission_records
    where organization_id=p_organization_id and activity_id=p_activity_id and status='APPROVED'
  ) then
    raise exception using errcode='22023',message='External approval must be recorded before activity conduct in this workflow';
  end if;

  select id into v_policy
  from public.impact_followup_policies
  where organization_id=p_organization_id
    and status in ('ACTIVE','SUPERSEDED')
    and effective_from<=p_conducted_at::date
    and (effective_to is null or effective_to>=p_conducted_at::date)
  order by effective_from desc,approved_at desc nulls last
  limit 1;
  if v_policy is null then
    raise exception using errcode='22023',message='No approved impact follow-up policy applies to the activity conduct date';
  end if;

  select internal_state into v_state
  from public.activities
  where id=p_activity_id and organization_id=p_organization_id
  for update;
  if v_state<>'EXTERNAL_TRACKING' then
    raise exception using errcode='22023',message='Activity must be in EXTERNAL_TRACKING before conduct is recorded';
  end if;

  update public.activities set internal_state='ACTIVITY_CONDUCTED' where id=p_activity_id;
  insert into public.activity_status_history(
    organization_id,activity_id,from_state,to_state,changed_by,role_context,reason
  ) values(
    p_organization_id,p_activity_id,v_state,'ACTIVITY_CONDUCTED',v_actor,p_role_context,
    'Activity conduct recorded after external approval'
  );

  for v_level in
    select * from public.impact_followup_policy_levels where policy_id=v_policy order by level
  loop
    insert into public.activity_impact_schedules(
      organization_id,activity_id,policy_id,level,due_at,grace_until,required,status
    ) values(
      p_organization_id,p_activity_id,v_policy,v_level.level,
      p_conducted_at+(v_level.due_offset_days||' days')::interval,
      p_conducted_at+((v_level.due_offset_days+v_level.grace_period_days)||' days')::interval,
      v_level.required,
      case when now()<p_conducted_at+(v_level.due_offset_days||' days')::interval then 'NOT_DUE' else 'DUE' end
    )
    on conflict(activity_id,level) do nothing;
  end loop;

  update public.activities set internal_state='IMPACT_FOLLOWUP' where id=p_activity_id;
  insert into public.activity_status_history(
    organization_id,activity_id,from_state,to_state,changed_by,role_context,reason
  ) values(
    p_organization_id,p_activity_id,'ACTIVITY_CONDUCTED','IMPACT_FOLLOWUP',v_actor,p_role_context,
    'Impact follow-up schedules generated from approved policy'
  );

  perform public.log_audit_event(
    p_organization_id,v_actor,p_role_context,'impact.followup_started','activity',p_activity_id,null,
    jsonb_build_object(
      'policy_id',v_policy,'conducted_at',p_conducted_at,
      'workflow',jsonb_build_array('ACTIVITY_CONDUCTED','IMPACT_FOLLOWUP')
    ),null,null,null
  );
end $$;
revoke all on function public.mark_activity_conducted_command(uuid,text,uuid,timestamptz) from public;
grant execute on function public.mark_activity_conducted_command(uuid,text,uuid,timestamptz) to authenticated;
