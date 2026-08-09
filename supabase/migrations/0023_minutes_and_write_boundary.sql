-- Remove direct committee structure writes: all changes must be audited through governed commands.
revoke insert,update,delete on public.institutional_committees,public.institutional_committee_members from authenticated;

alter table public.committee_minutes add column if not exists supersedes_minutes_id uuid;
alter table public.committee_minutes
  add constraint committee_minutes_supersedes_fk foreign key(supersedes_minutes_id,organization_id)
  references public.committee_minutes(id,organization_id);

create or replace function public.build_committee_minutes_snapshot(p_organization_id uuid,p_review_id uuid)
returns jsonb
language sql stable security definer set search_path=''
as $$
select jsonb_build_object(
  'document_type','INSTITUTIONAL_COMMITTEE_ACTIVITY_MINUTES',
  'activity',(
    select jsonb_build_object('id',a.id,'activity_code',a.activity_code,'title_ar',a.title_ar,'title_en',a.title_en)
    from public.activities a where a.id=r.activity_id and a.organization_id=p_organization_id
  ),
  'revision',(
    select jsonb_build_object('id',v.id,'revision_no',v.revision_no,'snapshot_sha256',v.snapshot_sha256,'submitted_at',v.submitted_at)
    from public.activity_revisions v where v.id=r.revision_id
  ),
  'meeting',(
    select jsonb_build_object('id',m.id,'meeting_reference',m.meeting_reference,'scheduled_at',m.scheduled_at,'location_or_channel',m.location_or_channel)
    from public.committee_meetings m where m.id=r.meeting_id
  ),
  'committee',(
    select jsonb_build_object(
      'committee_name',c.committee_name,'appointment_reference',c.appointment_reference,'effective_from',c.effective_from,'effective_to',c.effective_to,
      'members',coalesce((select jsonb_agg(jsonb_build_object('member_id',cm.id,'full_name',cm.full_name_snapshot,'role',cm.committee_role) order by cm.committee_role,cm.full_name_snapshot)
        from public.institutional_committee_members cm where cm.committee_id=c.id and cm.status='ACTIVE'),'[]'::jsonb)
    ) from public.committee_meetings mt join public.institutional_committees c on c.id=mt.committee_id where mt.id=r.meeting_id
  ),
  'attendance',coalesce((
    select jsonb_agg(jsonb_build_object('member_id',ma.committee_member_id,'status',ma.attendance_status,'full_name',cm.full_name_snapshot,'role',cm.committee_role) order by cm.committee_role,cm.full_name_snapshot)
    from public.meeting_attendance ma join public.institutional_committee_members cm on cm.id=ma.committee_member_id
    where ma.meeting_id=r.meeting_id
  ),'[]'::jsonb),
  'collective_results',coalesce((
    select jsonb_agg(jsonb_build_object(
      'criterion_code',sr.criterion_code,'criterion_text',sr.criterion_text,'source_rule_code',sr.source_rule_code,
      'evidence_availability',sr.evidence_availability,'assessment',sr.assessment,'notes',sr.notes,'corrective_action',sr.corrective_action
    ) order by sr.criterion_code)
    from public.committee_standard_results sr where sr.review_id=r.id
  ),'[]'::jsonb),
  'comments',coalesce((select jsonb_agg(jsonb_build_object('comment',cc.comment_text,'role_context',cc.role_context,'commented_at',cc.commented_at) order by cc.commented_at)
    from public.committee_comments cc where cc.review_id=r.id),'[]'::jsonb),
  'decision',(
    select jsonb_build_object('decision',d.decision,'decision_body',d.decision_body,'final_decision_by',d.final_decision_by,'decision_notes',d.decision_notes,'decided_at',d.decided_at)
    from public.committee_decisions d where d.review_id=r.id
  ),
  'generated_at',now()
)
from public.committee_reviews r
where r.id=p_review_id and r.organization_id=p_organization_id;
$$;
revoke all on function public.build_committee_minutes_snapshot(uuid,uuid) from public;

create or replace function public.draft_committee_minutes_command(
  p_organization_id uuid,p_role_context text,p_review_id uuid
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid(); v_activity uuid; v_meeting uuid; v_committee uuid; v_snapshot jsonb; v_version int; v_id uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'minutes.draft') then
    raise exception using errcode='42501',message='Active role context cannot draft minutes.';
  end if;
  select activity_id,meeting_id into v_activity,v_meeting from public.committee_reviews where id=p_review_id and organization_id=p_organization_id and status='DECIDED';
  if v_activity is null then raise exception using errcode='22023',message='A final committee decision is required before drafting minutes.'; end if;
  select committee_id into v_committee from public.committee_meetings where id=v_meeting and organization_id=p_organization_id;
  if not exists(select 1 from public.institutional_committee_members where committee_id=v_committee and user_id=v_actor and committee_role='SECRETARY' and status='ACTIVE') then
    raise exception using errcode='42501',message='User is not the active Committee Secretary.';
  end if;
  if exists(select 1 from public.committee_minutes where review_id=p_review_id and status in ('DRAFT','FINAL')) then
    raise exception using errcode='22023',message='Minutes already exist for this review.';
  end if;
  v_snapshot:=public.build_committee_minutes_snapshot(p_organization_id,p_review_id);
  select coalesce(max(version_no),0)+1 into v_version from public.committee_minutes where review_id=p_review_id;
  insert into public.committee_minutes(organization_id,activity_id,review_id,meeting_id,version_no,status,snapshot_json,prepared_by)
  values(p_organization_id,v_activity,p_review_id,v_meeting,v_version,'DRAFT',v_snapshot,v_actor) returning id into v_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'committee.minutes_drafted','committee_minutes',v_id,null,
    jsonb_build_object('activity_id',v_activity,'review_id',p_review_id,'version_no',v_version),null,null,null);
  return v_id;
end;
$$;
revoke all on function public.draft_committee_minutes_command(uuid,text,uuid) from public;
grant execute on function public.draft_committee_minutes_command(uuid,text,uuid) to authenticated;

create or replace function public.finalize_committee_minutes_command(
  p_organization_id uuid,p_role_context text,p_minutes_id uuid
)
returns void
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid(); v_review uuid; v_meeting uuid; v_committee uuid; v_snapshot jsonb; v_hash text; v_decision_actor uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'minutes.finalize') then
    raise exception using errcode='42501',message='Only the authorized Committee Chair can finalize minutes.';
  end if;
  select review_id,meeting_id,snapshot_json into v_review,v_meeting,v_snapshot
  from public.committee_minutes where id=p_minutes_id and organization_id=p_organization_id and status='DRAFT' for update;
  if v_review is null then raise exception using errcode='22023',message='Draft minutes not found.'; end if;
  select committee_id into v_committee from public.committee_meetings where id=v_meeting;
  if not exists(select 1 from public.institutional_committee_members where committee_id=v_committee and user_id=v_actor and committee_role='CHAIR' and status='ACTIVE') then
    raise exception using errcode='42501',message='User is not the active Committee Chair.';
  end if;
  select final_decision_by into v_decision_actor from public.committee_decisions where review_id=v_review;
  if v_decision_actor is null then raise exception using errcode='22023',message='Final decision record is missing.'; end if;
  v_hash:=encode(digest(v_snapshot::text,'sha256'),'hex');
  update public.committee_minutes set status='FINAL',snapshot_sha256=v_hash,finalized_by=v_actor,finalized_at=now() where id=p_minutes_id;
  update public.committee_reviews set status='CLOSED' where id=v_review;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'committee.minutes_finalized','committee_minutes',p_minutes_id,null,
    jsonb_build_object('snapshot_sha256',v_hash,'review_id',v_review),null,null,null);
end;
$$;
revoke all on function public.finalize_committee_minutes_command(uuid,text,uuid) from public;
grant execute on function public.finalize_committee_minutes_command(uuid,text,uuid) to authenticated;

create or replace function public.request_minutes_correction_command(
  p_organization_id uuid,p_role_context text,p_minutes_id uuid,p_reason text
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_id uuid;
begin
  if v_actor is null or not (
    public.current_role_has_permission(p_organization_id,p_role_context,'minutes.draft') or
    public.current_role_has_permission(p_organization_id,p_role_context,'minutes.finalize')
  ) then raise exception using errcode='42501',message='Active role context cannot request minutes correction.'; end if;
  if nullif(trim(p_reason),'') is null then raise exception using errcode='22023',message='Correction reason is required.'; end if;
  if not exists(select 1 from public.committee_minutes where id=p_minutes_id and organization_id=p_organization_id and status='FINAL') then raise exception using errcode='22023',message='Only final minutes can enter correction workflow.'; end if;
  insert into public.correction_requests(organization_id,entity_type,entity_id,reason,requested_by)
  values(p_organization_id,'COMMITTEE_MINUTES',p_minutes_id,trim(p_reason),v_actor) returning id into v_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'committee.minutes_correction_requested','committee_minutes',p_minutes_id,null,
    jsonb_build_object('correction_request_id',v_id,'reason',trim(p_reason)),null,null,null);
  return v_id;
end;
$$;
revoke all on function public.request_minutes_correction_command(uuid,text,uuid,text) from public;
grant execute on function public.request_minutes_correction_command(uuid,text,uuid,text) to authenticated;

create or replace function public.approve_minutes_correction_command(
  p_organization_id uuid,p_role_context text,p_request_id uuid
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid(); v_old uuid; v_activity uuid; v_review uuid; v_meeting uuid; v_snapshot jsonb; v_version int; v_new uuid; v_committee uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'minutes.finalize') then
    raise exception using errcode='42501',message='Only the Committee Chair can authorize minutes correction.';
  end if;
  select entity_id into v_old from public.correction_requests where id=p_request_id and organization_id=p_organization_id and entity_type='COMMITTEE_MINUTES' and status='PENDING' for update;
  if v_old is null then raise exception using errcode='22023',message='Pending correction request not found.'; end if;
  select activity_id,review_id,meeting_id into v_activity,v_review,v_meeting from public.committee_minutes where id=v_old and status='FINAL';
  select committee_id into v_committee from public.committee_meetings where id=v_meeting;
  if not exists(select 1 from public.institutional_committee_members where committee_id=v_committee and user_id=v_actor and committee_role='CHAIR' and status='ACTIVE') then raise exception using errcode='42501',message='User is not active Chair.'; end if;

  update public.committee_minutes set status='SUPERSEDED' where id=v_old;
  v_snapshot:=public.build_committee_minutes_snapshot(p_organization_id,v_review) || jsonb_build_object('correction_request_id',p_request_id,'supersedes_minutes_id',v_old);
  select coalesce(max(version_no),0)+1 into v_version from public.committee_minutes where review_id=v_review;
  insert into public.committee_minutes(organization_id,activity_id,review_id,meeting_id,version_no,status,snapshot_json,prepared_by,supersedes_minutes_id)
  values(p_organization_id,v_activity,v_review,v_meeting,v_version,'DRAFT',v_snapshot,v_actor,v_old) returning id into v_new;
  update public.correction_requests set status='APPROVED',reviewed_by=v_actor,reviewed_at=now() where id=p_request_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'committee.minutes_correction_approved','committee_minutes',v_old,null,
    jsonb_build_object('new_minutes_id',v_new,'correction_request_id',p_request_id),null,null,null);
  return v_new;
end;
$$;
revoke all on function public.approve_minutes_correction_command(uuid,text,uuid) from public;
grant execute on function public.approve_minutes_correction_command(uuid,text,uuid) to authenticated;
