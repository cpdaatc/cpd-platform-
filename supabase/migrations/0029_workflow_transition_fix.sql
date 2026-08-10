-- Preserve the canonical internal workflow transition: EXTERNAL_TRACKING -> ACTIVITY_CONDUCTED -> IMPACT_FOLLOWUP.

create or replace function public.mark_activity_conducted_command(p_organization_id uuid,p_role_context text,p_activity_id uuid,p_conducted_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_policy uuid; v_level record; v_state text;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'impact.manage') then raise exception using errcode='42501',message='Not authorized to manage impact'; end if;
  if p_role_context='ACTIVITY_OFFICER' and not public.current_user_is_assigned_activity(p_activity_id) then raise exception using errcode='42501',message='Activity Officer is not assigned'; end if;
  if not exists(select 1 from public.external_submission_records where organization_id=p_organization_id and activity_id=p_activity_id and status='APPROVED') then raise exception using errcode='22023',message='External approval must be recorded before activity conduct in this workflow'; end if;
  select id into v_policy from public.impact_followup_policies where organization_id=p_organization_id and status='ACTIVE' and (effective_from is null or effective_from<=p_conducted_at::date) and (effective_to is null or effective_to>=p_conducted_at::date) order by approved_at desc limit 1;
  if v_policy is null then raise exception using errcode='22023',message='No active impact follow-up policy'; end if;
  select internal_state into v_state from public.activities where id=p_activity_id and organization_id=p_organization_id for update;
  if v_state<>'EXTERNAL_TRACKING' then raise exception using errcode='22023',message='Activity must be in EXTERNAL_TRACKING before conduct is recorded'; end if;

  update public.activities set internal_state='ACTIVITY_CONDUCTED' where id=p_activity_id;
  insert into public.activity_status_history(organization_id,activity_id,from_state,to_state,changed_by,role_context,reason)
  values(p_organization_id,p_activity_id,v_state,'ACTIVITY_CONDUCTED',v_actor,p_role_context,'Activity conduct recorded after external approval');

  for v_level in select * from public.impact_followup_policy_levels where policy_id=v_policy order by level loop
    insert into public.activity_impact_schedules(organization_id,activity_id,policy_id,level,due_at,grace_until,required,status)
    values(p_organization_id,p_activity_id,v_policy,v_level.level,p_conducted_at+(v_level.due_offset_days||' days')::interval,p_conducted_at+((v_level.due_offset_days+v_level.grace_period_days)||' days')::interval,v_level.required,
      case when now()<p_conducted_at+(v_level.due_offset_days||' days')::interval then 'NOT_DUE' else 'DUE' end)
    on conflict(activity_id,level) do nothing;
  end loop;

  update public.activities set internal_state='IMPACT_FOLLOWUP' where id=p_activity_id;
  insert into public.activity_status_history(organization_id,activity_id,from_state,to_state,changed_by,role_context,reason)
  values(p_organization_id,p_activity_id,'ACTIVITY_CONDUCTED','IMPACT_FOLLOWUP',v_actor,p_role_context,'Impact follow-up schedules generated from approved policy');

  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'impact.followup_started','activity',p_activity_id,null,jsonb_build_object('policy_id',v_policy,'conducted_at',p_conducted_at,'workflow',jsonb_build_array('ACTIVITY_CONDUCTED','IMPACT_FOLLOWUP')),null,null,null);
end $$;
revoke all on function public.mark_activity_conducted_command(uuid,text,uuid,timestamptz) from public;
grant execute on function public.mark_activity_conducted_command(uuid,text,uuid,timestamptz) to authenticated;
