-- Release completion: an internally approved activity becomes ready for external SCFHS submission
-- only after the institutional committee minutes are finalized by the active Committee Chair.
-- This keeps the Chair decision and the external submission readiness gate distinct.
-- Keep pgcrypto resolution portable between Supabase (`extensions`) and standalone PostgreSQL (`public`).

create or replace function public.finalize_committee_minutes_command(
  p_organization_id uuid,p_role_context text,p_minutes_id uuid
)
returns void
language plpgsql security definer set search_path = pg_catalog, extensions, public
as $$
declare
  v_actor uuid:=auth.uid();
  v_review uuid;
  v_meeting uuid;
  v_committee uuid;
  v_activity uuid;
  v_snapshot jsonb;
  v_hash text;
  v_decision_actor uuid;
  v_decision text;
  v_activity_state text;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'minutes.finalize') then
    raise exception using errcode='42501',message='Only the authorized Committee Chair can finalize minutes.';
  end if;

  select review_id,meeting_id,activity_id,snapshot_json
  into v_review,v_meeting,v_activity,v_snapshot
  from public.committee_minutes
  where id=p_minutes_id and organization_id=p_organization_id and status='DRAFT'
  for update;
  if v_review is null then raise exception using errcode='22023',message='Draft minutes not found.'; end if;

  select committee_id into v_committee
  from public.committee_meetings
  where id=v_meeting and organization_id=p_organization_id;
  if not exists(
    select 1 from public.institutional_committee_members
    where committee_id=v_committee and user_id=v_actor and committee_role='CHAIR' and status='ACTIVE'
  ) then
    raise exception using errcode='42501',message='User is not the active Committee Chair.';
  end if;

  select final_decision_by,decision into v_decision_actor,v_decision
  from public.committee_decisions
  where review_id=v_review and organization_id=p_organization_id;
  if v_decision_actor is null then raise exception using errcode='22023',message='Final decision record is missing.'; end if;

  if v_decision='APPROVED_FOR_SCFHS_SUBMISSION' then
    select internal_state into v_activity_state
    from public.activities
    where id=v_activity and organization_id=p_organization_id
    for update;
    if v_activity_state not in ('APPROVED_FOR_SCFHS_SUBMISSION','READY_FOR_SCFHS_SUBMISSION') then
      raise exception using errcode='22023',message='Approved activity is not in the expected pre-submission state.';
    end if;
  end if;

  v_hash:=encode(digest(v_snapshot::text,'sha256'),'hex');
  update public.committee_minutes
  set status='FINAL',snapshot_sha256=v_hash,finalized_by=v_actor,finalized_at=now()
  where id=p_minutes_id;
  update public.committee_reviews set status='CLOSED' where id=v_review;

  if v_decision='APPROVED_FOR_SCFHS_SUBMISSION' and v_activity_state='APPROVED_FOR_SCFHS_SUBMISSION' then
    update public.activities
    set internal_state='READY_FOR_SCFHS_SUBMISSION',updated_at=now()
    where id=v_activity and organization_id=p_organization_id;
    insert into public.activity_status_history(
      organization_id,activity_id,from_state,to_state,changed_by,role_context,reason
    ) values (
      p_organization_id,v_activity,'APPROVED_FOR_SCFHS_SUBMISSION','READY_FOR_SCFHS_SUBMISSION',
      v_actor,p_role_context,'Final institutional committee minutes approved by Committee Chair'
    );
  end if;

  perform public.log_audit_event(
    p_organization_id,v_actor,p_role_context,'committee.minutes_finalized','committee_minutes',p_minutes_id,null,
    jsonb_build_object(
      'snapshot_sha256',v_hash,
      'review_id',v_review,
      'activity_id',v_activity,
      'committee_decision',v_decision,
      'activity_state_after',case when v_decision='APPROVED_FOR_SCFHS_SUBMISSION' then 'READY_FOR_SCFHS_SUBMISSION' else null end
    ),null,null,null
  );
end;
$$;

revoke all on function public.finalize_committee_minutes_command(uuid,text,uuid) from public;
grant execute on function public.finalize_committee_minutes_command(uuid,text,uuid) to authenticated;
