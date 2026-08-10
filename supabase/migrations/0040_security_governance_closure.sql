-- Production security closure: remove legacy direct-write/read paths and
-- enforce assignment, committee, audit, privacy and trusted-computation boundaries.

-- Audit rows may only be emitted by governed SECURITY DEFINER commands or a
-- trusted server operator. Authenticated API callers cannot fabricate events.
revoke all on function public.log_audit_event(uuid,uuid,text,text,text,uuid,jsonb,jsonb,inet,text,text) from public, anon, authenticated;
grant execute on function public.log_audit_event(uuid,uuid,text,text,text,uuid,jsonb,jsonb,inet,text,text) to service_role;

-- Full-chain verification is an operational server action, not a tenant API.
revoke all on function public.verify_audit_chain(uuid) from public, anon, authenticated;
grant execute on function public.verify_audit_chain(uuid) to service_role;

-- Remove direct mutation paths that bypass command validation and audit.
revoke insert, update, delete on public.extraction_field_results from authenticated;
revoke insert, update, delete on public.speakers from authenticated;
revoke insert, update, delete on public.reference_documents, public.regulatory_rules,
  public.rule_versions, public.source_conflicts, public.source_conflict_resolutions from authenticated;

drop policy if exists extraction_fields_org on public.extraction_field_results;
create policy extraction_fields_authorized_read on public.extraction_field_results
for select to authenticated
using (
  exists (
    select 1
    from public.extraction_runs er
    where er.id = extraction_run_id
      and er.organization_id = organization_id
      and public.can_edit_activity_intake(er.organization_id, er.activity_id)
  )
);

drop policy if exists speakers_select on public.speakers;
drop policy if exists speakers_write on public.speakers;
create policy speakers_authorized_read on public.speakers
for select to authenticated
using (
  public.current_user_has_permission(organization_id, 'activity.fill_submit')
  and (
    public.current_user_has_permission(organization_id, 'activity.view.all')
    or exists (
      select 1
      from public.activity_speakers aps
      where aps.speaker_id = speakers.id
        and aps.organization_id = speakers.organization_id
        and public.current_user_is_assigned_activity(aps.activity_id)
    )
  )
);

drop policy if exists reference_documents_org_write on public.reference_documents;
drop policy if exists regulatory_rules_org_write on public.regulatory_rules;
drop policy if exists rule_versions_org_write on public.rule_versions;
drop policy if exists source_conflicts_write on public.source_conflicts;
drop policy if exists source_conflict_resolutions_write on public.source_conflict_resolutions;

-- Sensitive read policies enforce the same role permissions used by pages.
drop policy if exists impact_policy_read on public.impact_followup_policies;
drop policy if exists impact_policy_levels_read on public.impact_followup_policy_levels;
drop policy if exists impact_methodology_read on public.impact_methodology_versions;
drop policy if exists impact_schedule_read on public.activity_impact_schedules;
drop policy if exists impact_level_read on public.impact_level_results;
drop policy if exists impact_objective_read on public.impact_objectives;
drop policy if exists impact_reports_read on public.impact_reports;
drop policy if exists impact_corrections_read on public.impact_correction_requests;
create policy impact_policy_read on public.impact_followup_policies for select to authenticated
using (public.current_user_has_permission(organization_id,'impact.view'));
create policy impact_policy_levels_read on public.impact_followup_policy_levels for select to authenticated
using (public.current_user_has_permission(organization_id,'impact.view'));
create policy impact_methodology_read on public.impact_methodology_versions for select to authenticated
using (public.current_user_has_permission(organization_id,'impact.view'));
create policy impact_schedule_read on public.activity_impact_schedules for select to authenticated
using (public.current_user_has_permission(organization_id,'impact.view'));
create policy impact_level_read on public.impact_level_results for select to authenticated
using (public.current_user_has_permission(organization_id,'impact.view'));
create policy impact_objective_read on public.impact_objectives for select to authenticated
using (public.current_user_has_permission(organization_id,'impact.view'));
create policy impact_reports_read on public.impact_reports for select to authenticated
using (public.current_user_has_permission(organization_id,'impact.view'));
create policy impact_corrections_read on public.impact_correction_requests for select to authenticated
using (public.current_user_has_permission(organization_id,'impact.view'));

drop policy if exists annual_reports_read on public.annual_committee_reports;
drop policy if exists annual_metrics_read on public.annual_report_metrics;
drop policy if exists member_contrib_read on public.member_contribution_metrics;
drop policy if exists annual_ack_read on public.annual_report_acknowledgements;
create policy annual_reports_read on public.annual_committee_reports for select to authenticated
using (public.current_user_has_permission(organization_id,'annual.view'));
create policy annual_metrics_read on public.annual_report_metrics for select to authenticated
using (public.current_user_has_permission(organization_id,'annual.view'));
create policy member_contrib_read on public.member_contribution_metrics for select to authenticated
using (public.current_user_has_permission(organization_id,'annual.view'));
create policy annual_ack_read on public.annual_report_acknowledgements for select to authenticated
using (public.current_user_has_permission(organization_id,'annual.view'));

drop policy if exists external_submission_read on public.external_submission_records;
drop policy if exists external_history_read on public.external_status_history;
create policy external_submission_read on public.external_submission_records for select to authenticated
using (public.current_user_has_permission(organization_id,'external.view'));
create policy external_history_read on public.external_status_history for select to authenticated
using (public.current_user_has_permission(organization_id,'external.view'));

create or replace function public.current_user_can_read_committee(p_organization_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.is_org_member(p_organization_id) and (
    public.current_user_has_permission(p_organization_id,'committee.manage_structure')
    or public.current_user_has_permission(p_organization_id,'committee.prepare')
    or public.current_user_has_permission(p_organization_id,'committee.record_collective')
    or public.current_user_has_permission(p_organization_id,'committee.comment')
    or public.current_user_has_permission(p_organization_id,'activity.final_decision')
    or public.current_user_has_permission(p_organization_id,'minutes.draft')
    or public.current_user_has_permission(p_organization_id,'minutes.finalize')
    or public.current_user_has_permission(p_organization_id,'report.view')
    or public.current_user_has_permission(p_organization_id,'audit.view')
  );
$$;
revoke all on function public.current_user_can_read_committee(uuid) from public;
grant execute on function public.current_user_can_read_committee(uuid) to authenticated, service_role;

drop policy if exists institutional_committees_read on public.institutional_committees;
drop policy if exists institutional_members_read on public.institutional_committee_members;
drop policy if exists committee_meetings_read on public.committee_meetings;
drop policy if exists meeting_attendance_read on public.meeting_attendance;
drop policy if exists committee_reviews_read on public.committee_reviews;
drop policy if exists committee_standard_results_read on public.committee_standard_results;
drop policy if exists committee_comments_read on public.committee_comments;
drop policy if exists committee_decisions_read on public.committee_decisions;
drop policy if exists committee_minutes_read on public.committee_minutes;
drop policy if exists correction_requests_read on public.correction_requests;
create policy institutional_committees_read on public.institutional_committees for select to authenticated
using (public.current_user_can_read_committee(organization_id));
create policy institutional_members_read on public.institutional_committee_members for select to authenticated
using (public.current_user_can_read_committee(organization_id));
create policy committee_meetings_read on public.committee_meetings for select to authenticated
using (public.current_user_can_read_committee(organization_id));
create policy meeting_attendance_read on public.meeting_attendance for select to authenticated
using (public.current_user_can_read_committee(organization_id));
create policy committee_reviews_read on public.committee_reviews for select to authenticated
using (public.current_user_can_read_committee(organization_id));
create policy committee_standard_results_read on public.committee_standard_results for select to authenticated
using (public.current_user_can_read_committee(organization_id));
create policy committee_comments_read on public.committee_comments for select to authenticated
using (public.current_user_can_read_committee(organization_id));
create policy committee_decisions_read on public.committee_decisions for select to authenticated
using (public.current_user_can_read_committee(organization_id));
create policy committee_minutes_read on public.committee_minutes for select to authenticated
using (public.current_user_can_read_committee(organization_id));
create policy correction_requests_read on public.correction_requests for select to authenticated
using (public.current_user_can_read_committee(organization_id));

-- Trusted pre-review persistence. Only the server secret can call this function;
-- actor identity and assignment are revalidated inside the transaction.
create or replace function public.user_role_has_permission(
  p_user_id uuid, p_organization_id uuid, p_role_context text, p_permission_code text
)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1
    from public.organization_memberships m
    join public.user_roles ur on ur.membership_id=m.id and ur.organization_id=m.organization_id
    join public.roles r on r.id=ur.role_id
    join public.role_permissions rp on rp.role_id=r.id
    join public.permissions p on p.id=rp.permission_id
    where m.user_id=p_user_id and m.organization_id=p_organization_id and m.status='ACTIVE'
      and r.code=p_role_context and p.code=p_permission_code
  );
$$;
revoke all on function public.user_role_has_permission(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.user_role_has_permission(uuid,uuid,text,text) to service_role;

revoke all on function public.save_pre_review_command(uuid,text,uuid,text,text,jsonb) from public, anon, authenticated;

create or replace function public.save_pre_review_server_command(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_role_context text,
  p_activity_id uuid,
  p_ruleset_version text,
  p_input_fingerprint text,
  p_findings jsonb
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_review_id uuid; v_finding jsonb; v_rule_version_id uuid;
begin
  if not public.user_role_has_permission(p_actor_user_id,p_organization_id,p_role_context,'ai.run_prereview') then
    raise exception using errcode='42501',message='Actor role cannot run pre-review.';
  end if;
  if not exists(select 1 from public.activities where id=p_activity_id and organization_id=p_organization_id) then
    raise exception using errcode='42501',message='Activity is not available in this organization.';
  end if;
  if not (
    public.user_role_has_permission(p_actor_user_id,p_organization_id,p_role_context,'activity.view.all')
    or exists(
      select 1 from public.activity_assignments aa
      join public.organization_memberships m on m.id=aa.membership_id and m.organization_id=aa.organization_id
      where aa.activity_id=p_activity_id and aa.organization_id=p_organization_id and aa.is_active
        and m.user_id=p_actor_user_id and m.status='ACTIVE'
    )
  ) then raise exception using errcode='42501',message='Actor is not assigned or authorized to review this activity.'; end if;
  if nullif(trim(p_ruleset_version),'') is null or p_input_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023',message='Canonical ruleset version and SHA-256 fingerprint are required.';
  end if;
  if jsonb_typeof(coalesce(p_findings,'[]'::jsonb)) <> 'array' then
    raise exception using errcode='22023',message='Pre-review findings must be an array.';
  end if;

  insert into public.ai_reviews(organization_id,activity_id,review_type,engine_type,ruleset_version,input_fingerprint,run_by,role_context,status,completed_at)
  values(p_organization_id,p_activity_id,'PRE_REVIEW','DETERMINISTIC',trim(p_ruleset_version),lower(p_input_fingerprint),p_actor_user_id,p_role_context,'COMPLETED',now())
  returning id into v_review_id;

  for v_finding in select * from jsonb_array_elements(coalesce(p_findings,'[]'::jsonb)) loop
    select rv.id into v_rule_version_id
    from public.regulatory_rules r join public.rule_versions rv on rv.rule_id=r.id and rv.status='ACTIVE'
    where r.rule_code=v_finding->>'ruleCode' and r.organization_id is null
    order by rv.created_at desc limit 1;
    insert into public.ai_findings(organization_id,ai_review_id,rule_version_id,rule_code,source_code,source_version,evidence_location,status,severity,rationale,recommendation,confidence)
    values(p_organization_id,v_review_id,v_rule_version_id,v_finding->>'ruleCode',v_finding->>'sourceCode',v_finding->>'sourceVersion',
      v_finding->>'evidenceLocation',v_finding->>'status',v_finding->>'severity',v_finding->>'rationale',v_finding->>'recommendation',coalesce((v_finding->>'confidence')::numeric,1));
  end loop;
  perform public.log_audit_event(p_organization_id,p_actor_user_id,p_role_context,'activity.pre_review_completed','activity',p_activity_id,null,
    jsonb_build_object('ai_review_id',v_review_id,'engine','DETERMINISTIC','ruleset_version',trim(p_ruleset_version),'input_fingerprint',lower(p_input_fingerprint),'finding_count',jsonb_array_length(coalesce(p_findings,'[]'::jsonb))),null,null,null);
  return v_review_id;
end $$;
revoke all on function public.save_pre_review_server_command(uuid,uuid,text,uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.save_pre_review_server_command(uuid,uuid,text,uuid,text,text,jsonb) to service_role;

-- Remove obsolete overloads that bypass the current evidence and source rules.
revoke all on function public.resolve_source_conflict_command(uuid,text,uuid,text,uuid) from public, anon, authenticated;
drop function if exists public.resolve_source_conflict_command(uuid,text,uuid,text,uuid);
revoke all on function public.approve_external_ai_privacy_command(uuid,text,boolean) from public, anon, authenticated;
drop function if exists public.approve_external_ai_privacy_command(uuid,text,boolean);

update public.organization_ai_settings
set external_ai_enabled=false, privacy_approved=false, approved_by=null, approved_at=null
where (external_ai_enabled or privacy_approved)
  and nullif(trim(coalesce(privacy_approval_reference,'')),'') is null;
alter table public.organization_ai_settings
  drop constraint if exists organization_ai_settings_approval_evidence_check;
alter table public.organization_ai_settings
  add constraint organization_ai_settings_approval_evidence_check check(
    (external_ai_enabled is not true and privacy_approved is not true)
    or (nullif(trim(privacy_approval_reference),'') is not null and approved_by is not null and approved_at is not null)
  );

create or replace function public.enforce_source_conflict_selection()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_a uuid; v_b uuid; v_org uuid;
begin
  select organization_id,source_document_a_id,source_document_b_id into v_org,v_a,v_b
  from public.source_conflicts where id=new.conflict_id;
  if v_org is null or v_org<>new.organization_id then raise exception 'Source conflict tenant mismatch'; end if;
  if new.selected_source_document_id is not null and new.selected_source_document_id not in (v_a,v_b) then
    raise exception 'Selected source must be one of the conflicting sources';
  end if;
  return new;
end $$;
drop trigger if exists source_conflict_selection_guard on public.source_conflict_resolutions;
create trigger source_conflict_selection_guard before insert or update on public.source_conflict_resolutions
for each row execute function public.enforce_source_conflict_selection();

-- Relationship-level integrity for committee attendance and participation.
create or replace function public.enforce_meeting_attendance_committee()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(
    select 1 from public.committee_meetings mt
    join public.institutional_committee_members cm on cm.committee_id=mt.committee_id and cm.organization_id=mt.organization_id
    where mt.id=new.meeting_id and mt.organization_id=new.organization_id
      and cm.id=new.committee_member_id and cm.status='ACTIVE'
      and cm.appointment_from<=mt.scheduled_at::date
      and (cm.appointment_to is null or cm.appointment_to>=mt.scheduled_at::date)
  ) then raise exception using errcode='23514',message='Attendance member does not belong to the meeting committee'; end if;
  return new;
end $$;
drop trigger if exists meeting_attendance_committee_guard on public.meeting_attendance;
create trigger meeting_attendance_committee_guard before insert or update on public.meeting_attendance
for each row execute function public.enforce_meeting_attendance_committee();

create or replace function public.add_committee_comment_command(
  p_organization_id uuid,p_role_context text,p_review_id uuid,p_comment text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id uuid; v_meeting uuid; v_committee uuid; v_scheduled date;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'committee.comment') then raise exception using errcode='42501',message='Not authorized'; end if;
  if nullif(trim(p_comment),'') is null then raise exception using errcode='22023',message='Comment is required'; end if;
  select cr.meeting_id,mt.committee_id,mt.scheduled_at::date into v_meeting,v_committee,v_scheduled
  from public.committee_reviews cr join public.committee_meetings mt on mt.id=cr.meeting_id and mt.organization_id=cr.organization_id
  where cr.id=p_review_id and cr.organization_id=p_organization_id;
  if v_committee is null or not exists(
    select 1 from public.institutional_committee_members cm
    where cm.committee_id=v_committee and cm.organization_id=p_organization_id and cm.user_id=v_actor and cm.status='ACTIVE'
      and cm.appointment_from<=v_scheduled and (cm.appointment_to is null or cm.appointment_to>=v_scheduled)
  ) then raise exception using errcode='42501',message='User is not an active member of this review committee'; end if;
  insert into public.committee_comments(organization_id,review_id,comment_text,commented_by,role_context)
  values(p_organization_id,p_review_id,trim(p_comment),v_actor,p_role_context) returning id into v_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'committee.comment_added','committee_review',p_review_id,null,jsonb_build_object('comment_id',v_id),null,null,null);
  return v_id;
end $$;
revoke all on function public.add_committee_comment_command(uuid,text,uuid,text) from public;
grant execute on function public.add_committee_comment_command(uuid,text,uuid,text) to authenticated;

-- Activity Officers remain assignment-scoped for every impact operation.
create or replace function public.enforce_impact_activity_scope(p_role_context text,p_activity_id uuid)
returns void language plpgsql stable security definer set search_path='' as $$
begin
  if p_role_context='ACTIVITY_OFFICER' and not public.current_user_is_assigned_activity(p_activity_id) then
    raise exception using errcode='42501',message='Activity Officer is not assigned to this activity';
  end if;
end $$;
revoke all on function public.enforce_impact_activity_scope(text,uuid) from public;
grant execute on function public.enforce_impact_activity_scope(text,uuid) to authenticated, service_role;

create or replace function public.record_impact_level_command(p_organization_id uuid,p_role_context text,p_activity_id uuid,p_level text,p_score numeric,p_source_data jsonb default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_schedule uuid; v_status text; v_id uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'impact.manage') then raise exception using errcode='42501',message='Not authorized'; end if;
  perform public.enforce_impact_activity_scope(p_role_context,p_activity_id);
  if p_score<0 or p_score>100 then raise exception using errcode='22023',message='Impact score must be 0-100'; end if;
  perform public.refresh_impact_schedule_statuses(p_organization_id,p_activity_id);
  select id,status into v_schedule,v_status from public.activity_impact_schedules where organization_id=p_organization_id and activity_id=p_activity_id and level=p_level for update;
  if v_schedule is null then raise exception using errcode='22023',message='Impact schedule not found'; end if;
  if v_status='NOT_DUE' then raise exception using errcode='22023',message='Impact level is not due yet'; end if;
  insert into public.impact_level_results(organization_id,activity_id,level,score,source_data,recorded_by)
  values(p_organization_id,p_activity_id,p_level,round(p_score,3),p_source_data,v_actor)
  on conflict(activity_id,level) do update set score=excluded.score,source_data=excluded.source_data,recorded_by=v_actor,recorded_at=now()
  returning id into v_id;
  update public.activity_impact_schedules set status='COMPLETED',completed_at=now() where id=v_schedule;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'impact.level_recorded','activity',p_activity_id,null,jsonb_build_object('level',p_level,'score',p_score),null,null,null);
  return v_id;
end $$;

create or replace function public.record_impact_objectives_command(p_organization_id uuid,p_role_context text,p_activity_id uuid,p_objectives jsonb)
returns numeric language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v jsonb; v_achievement numeric; v_weighted numeric; v_l4 numeric;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'impact.manage') then raise exception using errcode='42501',message='Not authorized'; end if;
  perform public.enforce_impact_activity_scope(p_role_context,p_activity_id);
  perform public.refresh_impact_schedule_statuses(p_organization_id,p_activity_id);
  if (select status from public.activity_impact_schedules where organization_id=p_organization_id and activity_id=p_activity_id and level='L4')='NOT_DUE' then raise exception using errcode='22023',message='L4 is not due yet'; end if;
  delete from public.impact_objectives where organization_id=p_organization_id and activity_id=p_activity_id;
  for v in select * from jsonb_array_elements(coalesce(p_objectives,'[]'::jsonb)) loop
    if (v->>'target')::numeric<0 or (v->>'postValue')::numeric<0 then raise exception using errcode='22023',message='Target and post values must be non-negative'; end if;
    if v->>'direction'='INCREASE' then
      if (v->>'target')::numeric=0 then raise exception using errcode='22023',message='Increase target cannot be zero'; end if;
      v_achievement:=least(((v->>'postValue')::numeric/(v->>'target')::numeric)*100,100);
    elsif v->>'direction'='DECREASE' then
      if (v->>'postValue')::numeric <= (v->>'target')::numeric then v_achievement:=100;
      elsif (v->>'postValue')::numeric=0 then v_achievement:=100;
      else v_achievement:=least(((v->>'target')::numeric/(v->>'postValue')::numeric)*100,100); end if;
    else raise exception using errcode='22023',message='Invalid objective direction'; end if;
    v_weighted:=v_achievement*(v->>'weight')::numeric/100;
    insert into public.impact_objectives(organization_id,activity_id,objective_text,impact_domain,indicator,direction,baseline,target,post_value,weight,achievement,weighted_score,data_source,recorded_by)
    values(p_organization_id,p_activity_id,v->>'objectiveText',v->>'impactDomain',v->>'indicator',v->>'direction',nullif(v->>'baseline','')::numeric,(v->>'target')::numeric,(v->>'postValue')::numeric,(v->>'weight')::numeric,round(v_achievement,3),round(v_weighted,4),v->>'dataSource',v_actor);
  end loop;
  select round(sum(achievement*weight)/nullif(sum(weight),0),3) into v_l4 from public.impact_objectives where organization_id=p_organization_id and activity_id=p_activity_id;
  if v_l4 is null then raise exception using errcode='22023',message='At least one L4 impact objective is required'; end if;
  perform public.record_impact_level_command(p_organization_id,p_role_context,p_activity_id,'L4',v_l4,jsonb_build_object('source','impact_objectives'));
  return v_l4;
end $$;

create or replace function public.generate_impact_report_command(p_organization_id uuid,p_role_context text,p_activity_id uuid,p_kind text)
returns uuid language plpgsql security definer set search_path=pg_catalog,extensions,public as $$
declare v_actor uuid:=auth.uid(); v_method uuid; v_weights jsonb; v_thresholds jsonb; v_scores jsonb; v_domains jsonb; v_objectives jsonb; v_snapshot jsonb; v_hash text; v_htvi numeric; v_rating text; v_version int; v_id uuid; v_state text;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'impact.finalize') then raise exception using errcode='42501',message='Not authorized to generate impact report'; end if;
  perform public.enforce_impact_activity_scope(p_role_context,p_activity_id);
  if p_kind not in ('INTERIM','FINAL') then raise exception using errcode='22023',message='Invalid impact report kind'; end if;
  perform public.refresh_impact_schedule_statuses(p_organization_id,p_activity_id);
  select id,weights,rating_thresholds into v_method,v_weights,v_thresholds from public.impact_methodology_versions where organization_id=p_organization_id and status='ACTIVE' order by approved_at desc limit 1;
  if v_method is null then raise exception using errcode='22023',message='No approved active HTVI methodology'; end if;
  select coalesce(jsonb_object_agg(level,score),'{}'::jsonb) into v_scores from public.impact_level_results where organization_id=p_organization_id and activity_id=p_activity_id;
  select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) into v_objectives from public.impact_objectives o where organization_id=p_organization_id and activity_id=p_activity_id;
  select coalesce(jsonb_object_agg(impact_domain,domain_score),'{}'::jsonb) into v_domains from (
    select impact_domain,round(sum(achievement*weight)/nullif(sum(weight),0),3) domain_score from public.impact_objectives where organization_id=p_organization_id and activity_id=p_activity_id group by impact_domain
  ) d;
  if p_kind='FINAL' then
    if exists(select 1 from public.activity_impact_schedules where organization_id=p_organization_id and activity_id=p_activity_id and required=true and status<>'COMPLETED') then raise exception using errcode='22023',message='Required impact components are incomplete; HTVI remains PENDING'; end if;
    if not (v_scores ? 'L1' and v_scores ? 'L2' and v_scores ? 'L3' and v_scores ? 'L4') then raise exception using errcode='22023',message='L1-L4 scores are required for HTVI v1'; end if;
    v_htvi:=round((((v_scores->>'L1')::numeric*(v_weights->>'L1')::numeric)+((v_scores->>'L2')::numeric*(v_weights->>'L2')::numeric)+((v_scores->>'L3')::numeric*(v_weights->>'L3')::numeric)+((v_scores->>'L4')::numeric*(v_weights->>'L4')::numeric))/100,3);
    v_rating:=case when v_htvi>=(v_thresholds->>'excellent')::numeric then 'EXCELLENT' when v_htvi>=(v_thresholds->>'very_good')::numeric then 'VERY_GOOD' when v_htvi>=(v_thresholds->>'good')::numeric then 'GOOD' else 'NEEDS_IMPROVEMENT' end;
  end if;
  v_snapshot:=jsonb_build_object('activity_id',p_activity_id,'kind',p_kind,'methodology_version_id',v_method,'weights',v_weights,'level_scores',v_scores,'impact_domains',v_domains,'objectives',v_objectives,'htvi_status',case when p_kind='FINAL' then 'FINAL' else 'PENDING' end,'htvi',v_htvi,'overall_rating',v_rating);
  v_hash:=encode(digest(v_snapshot::text,'sha256'),'hex');
  select coalesce(max(version_no),0)+1 into v_version from public.impact_reports where organization_id=p_organization_id and activity_id=p_activity_id and kind=p_kind;
  if p_kind='FINAL' then update public.impact_reports set status='SUPERSEDED' where organization_id=p_organization_id and activity_id=p_activity_id and kind='FINAL' and status='FINAL'; end if;
  insert into public.impact_reports(organization_id,activity_id,kind,version_no,status,methodology_version_id,htvi_status,htvi_score,overall_rating,snapshot_json,snapshot_sha256,generated_by,finalized_at)
  values(p_organization_id,p_activity_id,p_kind,v_version,case when p_kind='FINAL' then 'FINAL' else 'DRAFT' end,v_method,case when p_kind='FINAL' then 'FINAL' else 'PENDING' end,v_htvi,v_rating,v_snapshot,v_hash,v_actor,case when p_kind='FINAL' then now() else null end)
  returning id into v_id;
  if p_kind='FINAL' then
    select internal_state into v_state from public.activities where id=p_activity_id for update;
    update public.activities set internal_state='FINAL_IMPACT_REPORT' where id=p_activity_id;
    insert into public.activity_status_history(organization_id,activity_id,from_state,to_state,changed_by,role_context,reason) values(p_organization_id,p_activity_id,v_state,'FINAL_IMPACT_REPORT',v_actor,p_role_context,'Final impact report generated');
  end if;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'impact.report_generated','impact_report',v_id,null,jsonb_build_object('kind',p_kind,'htvi_status',case when p_kind='FINAL' then 'FINAL' else 'PENDING' end,'htvi',v_htvi,'snapshot_sha256',v_hash),null,null,null);
  return v_id;
end $$;

-- Pre-authorize server-only object creation before service-role Storage access.
create or replace function public.authorize_activity_upload_command(
  p_organization_id uuid,p_role_context text,p_activity_id uuid,p_activity_speaker_id uuid default null
)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'activity.fill_submit') then
    raise exception using errcode='42501',message='Active role cannot upload activity documents';
  end if;
  if not (public.current_role_has_permission(p_organization_id,p_role_context,'activity.view.all') or public.current_user_is_assigned_activity(p_activity_id)) then
    raise exception using errcode='42501',message='User is not assigned to this activity';
  end if;
  if not exists(select 1 from public.activities where id=p_activity_id and organization_id=p_organization_id) then
    raise exception using errcode='42501',message='Activity is not available';
  end if;
  if p_activity_speaker_id is not null and not exists(
    select 1 from public.activity_speakers where id=p_activity_speaker_id and activity_id=p_activity_id and organization_id=p_organization_id
  ) then raise exception using errcode='42501',message='Speaker is not part of this activity'; end if;
  return true;
end $$;
revoke all on function public.authorize_activity_upload_command(uuid,text,uuid,uuid) from public;
grant execute on function public.authorize_activity_upload_command(uuid,text,uuid,uuid) to authenticated;
