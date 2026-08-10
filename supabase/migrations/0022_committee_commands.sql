-- Phase 4 governed commands.

alter table public.activity_revisions drop constraint if exists activity_revisions_status_check;
alter table public.activity_revisions add constraint activity_revisions_status_check
check(status in ('WORKING','SUBMITTED','RETURNED','FINAL_ACCEPTED','NOT_APPROVED','SUPERSEDED'));

create or replace function public.build_activity_revision_snapshot(p_organization_id uuid,p_activity_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
select jsonb_build_object(
  'activity',(
    select jsonb_build_object(
      'id',a.id,'activity_code',a.activity_code,'title_ar',a.title_ar,'title_en',a.title_en,
      'activity_type',a.activity_type,'planned_start_date',a.planned_start_date,'planned_end_date',a.planned_end_date,
      'delivery_method',a.delivery_method,'reporting_year',a.reporting_year
    ) from public.activities a where a.id=p_activity_id and a.organization_id=p_organization_id
  ),
  'intake_profile',(select to_jsonb(p) from public.activity_intake_profiles p where p.activity_id=p_activity_id and p.organization_id=p_organization_id),
  'needs_assessment_tools',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at) from public.activity_needs_assessment_tools n where n.activity_id=p_activity_id and n.organization_id=p_organization_id),'[]'::jsonb),
  'learning_objectives',coalesce((select jsonb_agg(to_jsonb(o) order by o.sort_order,o.id) from public.activity_learning_objectives o where o.activity_id=p_activity_id and o.organization_id=p_organization_id),'[]'::jsonb),
  'activity_scientific_committee',(
    select jsonb_build_object(
      'committee',to_jsonb(c),
      'members',coalesce((select jsonb_agg(to_jsonb(m) order by m.sort_order,m.id) from public.activity_scientific_committee_members m where m.activity_scientific_committee_id=c.id),'[]'::jsonb)
    ) from public.activity_scientific_committees c where c.activity_id=p_activity_id and c.organization_id=p_organization_id
  ),
  'speakers',coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order,s.id) from public.activity_speakers s where s.activity_id=p_activity_id and s.organization_id=p_organization_id),'[]'::jsonb),
  'speaker_documents',coalesce((
    select jsonb_agg(jsonb_build_object('activity_speaker_id',d.activity_speaker_id,'document_type',d.document_type,'sha256',d.sha256,'version_no',d.version_no) order by d.activity_speaker_id,d.version_no)
    from public.activity_speaker_documents d
    join public.activity_speakers s on s.id=d.activity_speaker_id
    where s.activity_id=p_activity_id and d.organization_id=p_organization_id
  ),'[]'::jsonb),
  'sessions',coalesce((
    select jsonb_agg(jsonb_build_object(
      'session',to_jsonb(se),
      'speaker_ids',coalesce((select jsonb_agg(ss.activity_speaker_id order by ss.activity_speaker_id) from public.session_speakers ss where ss.session_id=se.id),'[]'::jsonb)
    ) order by se.sort_order,se.id)
    from public.activity_sessions se where se.activity_id=p_activity_id and se.organization_id=p_organization_id
  ),'[]'::jsonb),
  'disclosures',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at,d.id) from public.disclosure_records d where d.activity_id=p_activity_id and d.organization_id=p_organization_id),'[]'::jsonb),
  'evidence',coalesce((
    select jsonb_agg(jsonb_build_object('id',e.id,'evidence_type',e.evidence_type,'status',e.status,'sha256',e.sha256,'notes',e.notes) order by e.created_at,e.id)
    from public.activity_evidence e where e.activity_id=p_activity_id and e.organization_id=p_organization_id
  ),'[]'::jsonb),
  'latest_pre_review',(
    select jsonb_build_object(
      'review',to_jsonb(r),
      'findings',coalesce((select jsonb_agg(to_jsonb(f) order by f.severity,f.rule_code) from public.ai_findings f where f.ai_review_id=r.id),'[]'::jsonb)
    ) from public.ai_reviews r
    where r.activity_id=p_activity_id and r.organization_id=p_organization_id and r.review_type='PRE_REVIEW' and r.status='COMPLETED'
    order by r.completed_at desc limit 1
  )
);
$$;
revoke all on function public.build_activity_revision_snapshot(uuid,uuid) from public;

create or replace function public.configure_institutional_committee_command(
  p_organization_id uuid,p_role_context text,p_committee_name text,p_appointment_reference text,
  p_appointment_date date,p_appointed_by text,p_effective_from date,p_effective_to date,p_members jsonb
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_committee_id uuid; v_member jsonb; v_chairs int; v_secretaries int;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'committee.manage_structure') then
    raise exception using errcode='42501',message='Active role context cannot configure the institutional committee.';
  end if;
  select count(*) filter(where x->>'committeeRole'='CHAIR'),count(*) filter(where x->>'committeeRole'='SECRETARY')
  into v_chairs,v_secretaries from jsonb_array_elements(coalesce(p_members,'[]'::jsonb)) x;
  if v_chairs<>1 or v_secretaries<>1 then raise exception using errcode='22023',message='Exactly one Chair and one Secretary are required.'; end if;

  update public.institutional_committees set status='INACTIVE',updated_at=now() where organization_id=p_organization_id and status='ACTIVE';
  insert into public.institutional_committees(
    organization_id,committee_name,appointment_reference,appointment_date,appointed_by,effective_from,effective_to,status,created_by
  ) values(
    p_organization_id,p_committee_name,p_appointment_reference,p_appointment_date,p_appointed_by,p_effective_from,p_effective_to,'ACTIVE',v_actor
  ) returning id into v_committee_id;

  for v_member in select * from jsonb_array_elements(coalesce(p_members,'[]'::jsonb)) loop
    insert into public.institutional_committee_members(
      organization_id,committee_id,user_id,full_name_snapshot,committee_role,appointment_from,appointment_to,status
    ) values(
      p_organization_id,v_committee_id,nullif(v_member->>'userId','')::uuid,v_member->>'fullName',v_member->>'committeeRole',
      coalesce(nullif(v_member->>'appointmentFrom','')::date,p_effective_from),nullif(v_member->>'appointmentTo','')::date,'ACTIVE'
    );
  end loop;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'committee.structure_configured','institutional_committee',v_committee_id,null,
    jsonb_build_object('appointment_reference',p_appointment_reference,'members',jsonb_array_length(coalesce(p_members,'[]'::jsonb))),null,null,null);
  return v_committee_id;
end;
$$;
revoke all on function public.configure_institutional_committee_command(uuid,text,text,text,date,text,date,date,jsonb) from public;
grant execute on function public.configure_institutional_committee_command(uuid,text,text,text,date,text,date,date,jsonb) to authenticated;

create or replace function public.submit_activity_revision_command(
  p_organization_id uuid,p_role_context text,p_activity_id uuid,p_change_summary text default null
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid(); v_state text; v_working uuid; v_parent uuid; v_revision uuid; v_no int; v_snapshot jsonb; v_hash text;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'activity.submit_committee') then
    raise exception using errcode='42501',message='Active role context cannot submit to committee.';
  end if;
  if not (public.current_role_has_permission(p_organization_id,p_role_context,'activity.view.all') or public.current_user_is_assigned_activity(p_activity_id)) then
    raise exception using errcode='42501',message='User is not assigned or authorized for this activity.';
  end if;
  select internal_state,working_revision_id,latest_submitted_revision_id into v_state,v_working,v_parent
  from public.activities where id=p_activity_id and organization_id=p_organization_id for update;
  if v_state not in ('PLANNING_DRAFT','PRE_REVIEW','RETURNED_FOR_CORRECTION') then
    raise exception using errcode='22023',message='Activity is not in a submittable internal state.';
  end if;
  if not exists(select 1 from public.activity_intake_profiles where activity_id=p_activity_id and organization_id=p_organization_id and form_status='CONFIRMED') then
    raise exception using errcode='22023',message='Activity intake must be confirmed before committee submission.';
  end if;
  if (select count(*) from public.activity_scientific_committee_members m join public.activity_scientific_committees c on c.id=m.activity_scientific_committee_id where c.activity_id=p_activity_id and c.organization_id=p_organization_id)<2 then
    raise exception using errcode='22023',message='Activity scientific committee data is incomplete.';
  end if;
  if not exists(select 1 from public.activity_learning_objectives where activity_id=p_activity_id and organization_id=p_organization_id) then
    raise exception using errcode='22023',message='At least one learning objective is required.';
  end if;
  if not exists(select 1 from public.ai_reviews where activity_id=p_activity_id and organization_id=p_organization_id and review_type='PRE_REVIEW' and status='COMPLETED') then
    raise exception using errcode='22023',message='Run the current deterministic pre-review before committee submission.';
  end if;
  if v_state='RETURNED_FOR_CORRECTION' and nullif(trim(coalesce(p_change_summary,'')),'') is null then
    raise exception using errcode='22023',message='Change summary is required for resubmission.';
  end if;

  v_snapshot:=public.build_activity_revision_snapshot(p_organization_id,p_activity_id);
  v_hash:=encode(digest(v_snapshot::text,'sha256'),'hex');

  if v_working is not null then
    update public.activity_revisions set snapshot_json=v_snapshot,snapshot_sha256=v_hash,status='SUBMITTED',change_summary=p_change_summary,submitted_by=v_actor,submitted_at=now()
    where id=v_working and organization_id=p_organization_id and status='WORKING'
    returning id into v_revision;
    if v_revision is null then raise exception 'Working revision cannot be submitted'; end if;
  else
    select coalesce(max(revision_no),0)+1 into v_no from public.activity_revisions where activity_id=p_activity_id;
    insert into public.activity_revisions(
      organization_id,activity_id,revision_no,parent_revision_id,status,snapshot_json,snapshot_sha256,change_summary,created_by,submitted_by,submitted_at
    ) values(
      p_organization_id,p_activity_id,v_no,v_parent,'SUBMITTED',v_snapshot,v_hash,p_change_summary,v_actor,v_actor,now()
    ) returning id into v_revision;
  end if;

  update public.activities set internal_state='READY_FOR_COMMITTEE',working_revision_id=null,latest_submitted_revision_id=v_revision,updated_at=now() where id=p_activity_id;
  insert into public.activity_status_history(organization_id,activity_id,from_state,to_state,changed_by,role_context,reason)
  values(p_organization_id,p_activity_id,v_state,'READY_FOR_COMMITTEE',v_actor,p_role_context,'Submitted immutable activity revision for institutional committee review');
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'activity.revision_submitted','activity',p_activity_id,null,
    jsonb_build_object('revision_id',v_revision,'snapshot_sha256',v_hash,'change_summary',p_change_summary),null,null,null);
  return v_revision;
end;
$$;
revoke all on function public.submit_activity_revision_command(uuid,text,uuid,text) from public;
grant execute on function public.submit_activity_revision_command(uuid,text,uuid,text) to authenticated;

create or replace function public.create_committee_meeting_command(
  p_organization_id uuid,p_role_context text,p_scheduled_at timestamptz,p_location_or_channel text,p_meeting_reference text default null
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_committee uuid; v_meeting uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'committee.prepare') then
    raise exception using errcode='42501',message='Active role context cannot prepare committee meetings.';
  end if;
  select id into v_committee from public.institutional_committees where organization_id=p_organization_id and status='ACTIVE' limit 1;
  if v_committee is null then raise exception using errcode='22023',message='No active institutional committee is configured.'; end if;
  if not exists(select 1 from public.institutional_committee_members where committee_id=v_committee and user_id=v_actor and committee_role='SECRETARY' and status='ACTIVE') then
    raise exception using errcode='42501',message='User is not the active secretary of this committee.';
  end if;
  insert into public.committee_meetings(organization_id,committee_id,meeting_reference,scheduled_at,location_or_channel,created_by)
  values(p_organization_id,v_committee,p_meeting_reference,p_scheduled_at,p_location_or_channel,v_actor) returning id into v_meeting;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'committee.meeting_created','committee_meeting',v_meeting,null,null,null,null,null);
  return v_meeting;
end;
$$;
revoke all on function public.create_committee_meeting_command(uuid,text,timestamptz,text,text) from public;
grant execute on function public.create_committee_meeting_command(uuid,text,timestamptz,text,text) to authenticated;

create or replace function public.record_meeting_attendance_command(
  p_organization_id uuid,p_role_context text,p_meeting_id uuid,p_attendance jsonb
)
returns void
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_item jsonb; v_committee uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'committee.prepare') then raise exception using errcode='42501',message='Not authorized'; end if;
  select committee_id into v_committee from public.committee_meetings where id=p_meeting_id and organization_id=p_organization_id;
  if not exists(select 1 from public.institutional_committee_members where committee_id=v_committee and user_id=v_actor and committee_role='SECRETARY' and status='ACTIVE') then raise exception using errcode='42501',message='User is not active secretary'; end if;
  for v_item in select * from jsonb_array_elements(coalesce(p_attendance,'[]'::jsonb)) loop
    insert into public.meeting_attendance(organization_id,meeting_id,committee_member_id,attendance_status,recorded_by)
    values(p_organization_id,p_meeting_id,(v_item->>'committeeMemberId')::uuid,v_item->>'status',v_actor)
    on conflict(meeting_id,committee_member_id) do update set attendance_status=excluded.attendance_status,recorded_by=v_actor,recorded_at=now();
  end loop;
  update public.committee_meetings set status='HELD' where id=p_meeting_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'committee.attendance_recorded','committee_meeting',p_meeting_id,null,
    jsonb_build_object('count',jsonb_array_length(coalesce(p_attendance,'[]'::jsonb))),null,null,null);
end;
$$;
revoke all on function public.record_meeting_attendance_command(uuid,text,uuid,jsonb) from public;
grant execute on function public.record_meeting_attendance_command(uuid,text,uuid,jsonb) to authenticated;

create or replace function public.open_committee_review_command(
  p_organization_id uuid,p_role_context text,p_activity_id uuid,p_meeting_id uuid
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_revision uuid; v_review uuid; v_state text;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'committee.prepare') then raise exception using errcode='42501',message='Not authorized'; end if;
  if not exists(
    select 1 from public.committee_meetings mt join public.institutional_committee_members m on m.committee_id=mt.committee_id
    where mt.id=p_meeting_id and mt.organization_id=p_organization_id and m.user_id=v_actor and m.committee_role='SECRETARY' and m.status='ACTIVE'
  ) then raise exception using errcode='42501',message='User is not secretary for this meeting'; end if;
  select internal_state,latest_submitted_revision_id into v_state,v_revision from public.activities where id=p_activity_id and organization_id=p_organization_id for update;
  if v_state<>'READY_FOR_COMMITTEE' or v_revision is null then raise exception using errcode='22023',message='Activity is not ready for committee review'; end if;
  insert into public.committee_reviews(organization_id,activity_id,revision_id,meeting_id,status,recorded_by)
  values(p_organization_id,p_activity_id,v_revision,p_meeting_id,'DRAFT',v_actor) returning id into v_review;
  update public.activities set internal_state='UNDER_COMMITTEE_REVIEW',updated_at=now() where id=p_activity_id;
  insert into public.activity_status_history(organization_id,activity_id,from_state,to_state,changed_by,role_context,reason)
  values(p_organization_id,p_activity_id,v_state,'UNDER_COMMITTEE_REVIEW',v_actor,p_role_context,'Institutional committee review opened');
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'committee.review_opened','committee_review',v_review,null,
    jsonb_build_object('activity_id',p_activity_id,'revision_id',v_revision,'meeting_id',p_meeting_id),null,null,null);
  return v_review;
end;
$$;
revoke all on function public.open_committee_review_command(uuid,text,uuid,uuid) from public;
grant execute on function public.open_committee_review_command(uuid,text,uuid,uuid) to authenticated;

create or replace function public.record_collective_assessment_command(
  p_organization_id uuid,p_role_context text,p_review_id uuid,p_results jsonb
)
returns void
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_item jsonb; v_meeting uuid; v_committee uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'committee.record_collective') then raise exception using errcode='42501',message='Not authorized'; end if;
  select meeting_id into v_meeting from public.committee_reviews where id=p_review_id and organization_id=p_organization_id;
  select committee_id into v_committee from public.committee_meetings where id=v_meeting and organization_id=p_organization_id;
  if not exists(select 1 from public.institutional_committee_members where committee_id=v_committee and user_id=v_actor and committee_role='SECRETARY' and status='ACTIVE') then raise exception using errcode='42501',message='User is not active secretary'; end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_results,'[]'::jsonb)) loop
    insert into public.committee_standard_results(
      organization_id,review_id,criterion_code,criterion_text,source_rule_code,evidence_availability,assessment,notes,corrective_action,recorded_by
    ) values(
      p_organization_id,p_review_id,v_item->>'criterionCode',v_item->>'criterionText',nullif(v_item->>'sourceRuleCode',''),
      v_item->>'evidenceAvailability',v_item->>'assessment',nullif(v_item->>'notes',''),nullif(v_item->>'correctiveAction',''),v_actor
    ) on conflict(review_id,criterion_code) do update set
      criterion_text=excluded.criterion_text,source_rule_code=excluded.source_rule_code,evidence_availability=excluded.evidence_availability,
      assessment=excluded.assessment,notes=excluded.notes,corrective_action=excluded.corrective_action,recorded_by=v_actor,recorded_at=now();
  end loop;
  update public.committee_reviews set status='RECORDED',recorded_by=v_actor,recorded_at=now() where id=p_review_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'committee.collective_assessment_recorded','committee_review',p_review_id,null,
    jsonb_build_object('criteria_count',jsonb_array_length(coalesce(p_results,'[]'::jsonb))),null,null,null);
end;
$$;
revoke all on function public.record_collective_assessment_command(uuid,text,uuid,jsonb) from public;
grant execute on function public.record_collective_assessment_command(uuid,text,uuid,jsonb) to authenticated;

create or replace function public.add_committee_comment_command(
  p_organization_id uuid,p_role_context text,p_review_id uuid,p_comment text
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_id uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'committee.comment') then raise exception using errcode='42501',message='Not authorized'; end if;
  if nullif(trim(p_comment),'') is null then raise exception using errcode='22023',message='Comment is required'; end if;
  insert into public.committee_comments(organization_id,review_id,comment_text,commented_by,role_context)
  values(p_organization_id,p_review_id,trim(p_comment),v_actor,p_role_context) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.add_committee_comment_command(uuid,text,uuid,text) from public;
grant execute on function public.add_committee_comment_command(uuid,text,uuid,text) to authenticated;

create or replace function public.final_committee_decision_command(
  p_organization_id uuid,p_role_context text,p_review_id uuid,p_decision text,p_decision_notes text default null
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid(); v_activity uuid; v_revision uuid; v_meeting uuid; v_committee uuid; v_state text; v_decision_id uuid; v_next_revision uuid; v_next_no int;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'activity.final_decision') then
    raise exception using errcode='42501',message='Only the authorized Committee Chair role can make the final activity decision.';
  end if;
  if p_decision not in ('APPROVED_FOR_SCFHS_SUBMISSION','RETURNED_FOR_CORRECTION','NOT_APPROVED') then raise exception using errcode='22023',message='Invalid committee decision'; end if;
  select activity_id,revision_id,meeting_id,status into v_activity,v_revision,v_meeting,v_state from public.committee_reviews where id=p_review_id and organization_id=p_organization_id for update;
  if v_activity is null or v_state<>'RECORDED' then raise exception using errcode='22023',message='Collective committee assessment must be recorded before final decision.'; end if;
  select committee_id into v_committee from public.committee_meetings where id=v_meeting and organization_id=p_organization_id;
  if not exists(select 1 from public.institutional_committee_members where committee_id=v_committee and user_id=v_actor and committee_role='CHAIR' and status='ACTIVE') then
    raise exception using errcode='42501',message='User is not the active Chair of this institutional committee.';
  end if;

  insert into public.committee_decisions(organization_id,activity_id,review_id,revision_id,decision,recorded_by,final_decision_by,decision_notes)
  values(p_organization_id,v_activity,p_review_id,v_revision,p_decision,null,v_actor,p_decision_notes) returning id into v_decision_id;
  update public.committee_reviews set status='DECIDED' where id=p_review_id;

  select internal_state into v_state from public.activities where id=v_activity for update;
  if p_decision='APPROVED_FOR_SCFHS_SUBMISSION' then
    update public.activity_revisions set status='FINAL_ACCEPTED',finalized_at=now() where id=v_revision;
    update public.activities set internal_state='APPROVED_FOR_SCFHS_SUBMISSION',working_revision_id=null,updated_at=now() where id=v_activity;
    insert into public.activity_status_history(organization_id,activity_id,from_state,to_state,changed_by,role_context,reason)
    values(p_organization_id,v_activity,v_state,'APPROVED_FOR_SCFHS_SUBMISSION',v_actor,p_role_context,'Final internal approval by Committee Chair');
  elsif p_decision='NOT_APPROVED' then
    update public.activity_revisions set status='NOT_APPROVED',finalized_at=now() where id=v_revision;
    update public.activities set internal_state='NOT_APPROVED',working_revision_id=null,updated_at=now() where id=v_activity;
    insert into public.activity_status_history(organization_id,activity_id,from_state,to_state,changed_by,role_context,reason)
    values(p_organization_id,v_activity,v_state,'NOT_APPROVED',v_actor,p_role_context,'Final not-approved decision by Committee Chair');
  else
    update public.activity_revisions set status='RETURNED',returned_at=now() where id=v_revision;
    select coalesce(max(revision_no),0)+1 into v_next_no from public.activity_revisions where activity_id=v_activity;
    insert into public.activity_revisions(organization_id,activity_id,revision_no,parent_revision_id,status,change_summary,created_by)
    values(p_organization_id,v_activity,v_next_no,v_revision,'WORKING','Created after committee return for correction',v_actor) returning id into v_next_revision;
    update public.activities set internal_state='RETURNED_FOR_CORRECTION',working_revision_id=v_next_revision,updated_at=now() where id=v_activity;
    insert into public.activity_status_history(organization_id,activity_id,from_state,to_state,changed_by,role_context,reason)
    values(p_organization_id,v_activity,v_state,'RETURNED_FOR_CORRECTION',v_actor,p_role_context,coalesce(p_decision_notes,'Returned for correction by Committee Chair'));
  end if;

  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'committee.final_decision','activity',v_activity,null,
    jsonb_build_object('decision_id',v_decision_id,'review_id',p_review_id,'revision_id',v_revision,'decision',p_decision,'working_revision_id',v_next_revision),null,null,null);
  return v_decision_id;
end;
$$;
revoke all on function public.final_committee_decision_command(uuid,text,uuid,text,text) from public;
grant execute on function public.final_committee_decision_command(uuid,text,uuid,text,text) to authenticated;
