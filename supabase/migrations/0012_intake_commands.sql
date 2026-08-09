-- Phase 2 governed commands: all sensitive intake writes validate active role context and audit atomically.

alter table public.activity_speakers add column if not exists client_key text;
create unique index if not exists activity_speakers_client_key_uq
  on public.activity_speakers(activity_id, client_key) where client_key is not null;

create table if not exists public.activity_speaker_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_speaker_id uuid not null,
  document_type text not null default 'CV' check (document_type in ('CV','CERTIFICATE','OTHER')),
  storage_path text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-fA-F]{64}$'),
  version_no integer not null default 1 check (version_no > 0),
  uploaded_by uuid not null references public.users(id),
  uploaded_at timestamptz not null default now(),
  unique(activity_speaker_id,document_type,version_no),
  foreign key(activity_speaker_id,organization_id) references public.activity_speakers(id,organization_id) on delete cascade
);
alter table public.activity_speaker_documents enable row level security;
create policy activity_speaker_documents_select on public.activity_speaker_documents for select to authenticated
using (public.is_org_member(organization_id));
create policy activity_speaker_documents_insert on public.activity_speaker_documents for insert to authenticated
with check (public.is_org_member(organization_id) and uploaded_by=auth.uid());
grant select,insert on public.activity_speaker_documents to authenticated;

create or replace function public.save_activity_intake_command(
  p_organization_id uuid,
  p_role_context text,
  p_activity_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor uuid := auth.uid();
  v_profile_id uuid;
  v_committee_id uuid;
  v_item jsonb;
  v_session jsonb;
  v_speaker_id uuid;
  v_session_id uuid;
  v_old_state text;
begin
  if v_actor is null then raise exception using errcode='42501',message='Authenticated user is required.'; end if;
  if not exists(select 1 from public.activities a where a.id=p_activity_id and a.organization_id=p_organization_id) then
    raise exception using errcode='42501',message='Activity is not available in this organization.';
  end if;
  if not public.current_role_has_permission(p_organization_id,p_role_context,'activity.fill_submit') then
    raise exception using errcode='42501',message='Active role context cannot edit activity intake.';
  end if;
  if not (
    public.current_role_has_permission(p_organization_id,p_role_context,'activity.view.all')
    or public.current_user_is_assigned_activity(p_activity_id)
  ) then
    raise exception using errcode='42501',message='User is not assigned or authorized for this activity.';
  end if;

  insert into public.activity_intake_profiles(
    organization_id,activity_id,intake_route,specialty,activity_languages,collaboration,
    collaborator_organization_name,collaborator_type,content_developed_by_provider,content_developer,
    target_audience,select_all_medical_fields,category_specific,learning_gap,aim_and_outcomes,
    learning_methods,participant_evaluation_method,activity_scope,scfhs_registration_number,
    form_status,created_by,updated_by
  ) values (
    p_organization_id,p_activity_id,coalesce(p_payload#>>'{profile,intakeRoute}','DIGITAL'),
    nullif(p_payload#>>'{profile,specialty}',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_payload#>'{profile,activityLanguages}','[]'::jsonb))),array[]::text[]),
    nullif(p_payload#>>'{profile,collaboration}','')::boolean,
    nullif(p_payload#>>'{profile,collaboratorOrganizationName}',''),nullif(p_payload#>>'{profile,collaboratorType}',''),
    nullif(p_payload#>>'{profile,contentDevelopedByProvider}','')::boolean,nullif(p_payload#>>'{profile,contentDeveloper}',''),
    nullif(p_payload#>>'{profile,targetAudience}',''),coalesce((p_payload#>>'{profile,selectAllMedicalFields}')::boolean,false),
    nullif(p_payload#>>'{profile,categorySpecific}',''),nullif(p_payload#>>'{profile,learningGap}',''),
    nullif(p_payload#>>'{profile,aimAndOutcomes}',''),nullif(p_payload#>>'{profile,learningMethods}',''),
    nullif(p_payload#>>'{profile,participantEvaluationMethod}',''),nullif(p_payload#>>'{profile,activityScope}',''),
    nullif(p_payload#>>'{profile,scfhsRegistrationNumber}',''),coalesce(p_payload#>>'{profile,formStatus}','DRAFT'),v_actor,v_actor
  )
  on conflict(activity_id) do update set
    intake_route=excluded.intake_route,specialty=excluded.specialty,activity_languages=excluded.activity_languages,
    collaboration=excluded.collaboration,collaborator_organization_name=excluded.collaborator_organization_name,
    collaborator_type=excluded.collaborator_type,content_developed_by_provider=excluded.content_developed_by_provider,
    content_developer=excluded.content_developer,target_audience=excluded.target_audience,
    select_all_medical_fields=excluded.select_all_medical_fields,category_specific=excluded.category_specific,
    learning_gap=excluded.learning_gap,aim_and_outcomes=excluded.aim_and_outcomes,learning_methods=excluded.learning_methods,
    participant_evaluation_method=excluded.participant_evaluation_method,activity_scope=excluded.activity_scope,
    scfhs_registration_number=excluded.scfhs_registration_number,form_status=excluded.form_status,updated_by=v_actor
  returning id into v_profile_id;

  delete from public.activity_needs_assessment_tools where activity_id=p_activity_id;
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'needsAssessmentTools','[]'::jsonb)) loop
    insert into public.activity_needs_assessment_tools(organization_id,activity_id,tool_code,other_text)
    values(p_organization_id,p_activity_id,v_item->>'toolCode',nullif(v_item->>'otherText',''));
  end loop;

  delete from public.activity_learning_objectives where activity_id=p_activity_id;
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'objectives','[]'::jsonb)) loop
    if nullif(trim(v_item->>'objectiveText'),'') is not null then
      insert into public.activity_learning_objectives(organization_id,activity_id,objective_text,learning_domain,sort_order)
      values(p_organization_id,p_activity_id,v_item->>'objectiveText',nullif(v_item->>'learningDomain',''),coalesce((v_item->>'sortOrder')::integer,1));
    end if;
  end loop;

  insert into public.activity_scientific_committees(organization_id,activity_id,status,created_by)
  values(p_organization_id,p_activity_id,'ACTIVE',v_actor)
  on conflict(activity_id) do update set status='ACTIVE'
  returning id into v_committee_id;
  delete from public.activity_scientific_committee_members where activity_scientific_committee_id=v_committee_id;
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'committeeMembers','[]'::jsonb)) loop
    if nullif(trim(v_item->>'fullName'),'') is not null then
      insert into public.activity_scientific_committee_members(
        organization_id,activity_scientific_committee_id,full_name,professional_classification_number,specialty,institution,committee_role,sort_order
      ) values (
        p_organization_id,v_committee_id,v_item->>'fullName',nullif(v_item->>'classificationNumber',''),nullif(v_item->>'specialty',''),
        nullif(v_item->>'institution',''),nullif(v_item->>'committeeRole',''),coalesce((v_item->>'sortOrder')::integer,1)
      );
    end if;
  end loop;

  delete from public.session_speakers where session_id in (select id from public.activity_sessions where activity_id=p_activity_id);
  delete from public.activity_sessions where activity_id=p_activity_id;
  delete from public.activity_speakers where activity_id=p_activity_id;
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'speakers','[]'::jsonb)) loop
    if nullif(trim(v_item->>'fullName'),'') is not null then
      insert into public.activity_speakers(
        organization_id,activity_id,client_key,full_name_snapshot,specialty_snapshot,grade_snapshot,institution_snapshot,
        related_experience_past_three_years,qualifications_summary,special_certificates_summary,international_presentations_count,sort_order
      ) values (
        p_organization_id,p_activity_id,coalesce(nullif(v_item->>'clientKey',''),gen_random_uuid()::text),v_item->>'fullName',
        nullif(v_item->>'specialty',''),nullif(v_item->>'grade',''),nullif(v_item->>'institution',''),
        nullif(v_item->>'relatedExperiencePastThreeYears',''),nullif(v_item->>'qualificationsSummary',''),
        nullif(v_item->>'specialCertificatesSummary',''),nullif(v_item->>'internationalPresentationsCount','')::integer,
        coalesce((v_item->>'sortOrder')::integer,1)
      );
    end if;
  end loop;

  for v_session in select * from jsonb_array_elements(coalesce(p_payload->'sessions','[]'::jsonb)) loop
    if nullif(trim(v_session->>'topicName'),'') is not null then
      insert into public.activity_sessions(organization_id,activity_id,day_label,topic_name,starts_at,ends_at,sort_order)
      values(
        p_organization_id,p_activity_id,nullif(v_session->>'dayLabel',''),v_session->>'topicName',
        nullif(v_session->>'startsAt','')::timestamptz,nullif(v_session->>'endsAt','')::timestamptz,
        coalesce((v_session->>'sortOrder')::integer,1)
      ) returning id into v_session_id;
      for v_item in select * from jsonb_array_elements_text(coalesce(v_session->'speakerKeys','[]'::jsonb)) loop
        select id into v_speaker_id from public.activity_speakers
        where activity_id=p_activity_id and client_key=trim(both '"' from v_item::text) limit 1;
        if v_speaker_id is not null then
          insert into public.session_speakers(organization_id,session_id,activity_speaker_id)
          values(p_organization_id,v_session_id,v_speaker_id) on conflict do nothing;
        end if;
      end loop;
    end if;
  end loop;

  delete from public.disclosure_records where activity_id=p_activity_id;
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'disclosures','[]'::jsonb)) loop
    if nullif(trim(v_item->>'personName'),'') is not null then
      insert into public.disclosure_records(organization_id,activity_id,person_name,person_role,declaration_status,commercial_relationship_summary,created_by)
      values(p_organization_id,p_activity_id,v_item->>'personName',coalesce(nullif(v_item->>'personRole',''),'OTHER'),
        coalesce(nullif(v_item->>'declarationStatus',''),'PENDING'),nullif(v_item->>'commercialRelationshipSummary',''),v_actor);
    end if;
  end loop;

  select internal_state into v_old_state from public.activities where id=p_activity_id for update;
  if v_old_state='CREATED' then
    update public.activities set internal_state='PLANNING_DRAFT',updated_at=now() where id=p_activity_id;
    insert into public.activity_status_history(organization_id,activity_id,from_state,to_state,changed_by,role_context,reason)
    values(p_organization_id,p_activity_id,'CREATED','PLANNING_DRAFT',v_actor,p_role_context,'Activity intake started');
  end if;

  perform public.log_audit_event(
    p_organization_id,v_actor,p_role_context,'activity.intake_saved','activity',p_activity_id,null,
    jsonb_build_object(
      'profile_id',v_profile_id,
      'route',coalesce(p_payload#>>'{profile,intakeRoute}','DIGITAL'),
      'objectives',jsonb_array_length(coalesce(p_payload->'objectives','[]'::jsonb)),
      'committee_members',jsonb_array_length(coalesce(p_payload->'committeeMembers','[]'::jsonb)),
      'speakers',jsonb_array_length(coalesce(p_payload->'speakers','[]'::jsonb)),
      'sessions',jsonb_array_length(coalesce(p_payload->'sessions','[]'::jsonb))
    ),null,null,null
  );
  return v_profile_id;
end;
$$;
revoke all on function public.save_activity_intake_command(uuid,text,uuid,jsonb) from public;
grant execute on function public.save_activity_intake_command(uuid,text,uuid,jsonb) to authenticated;

create or replace function public.register_intake_document_command(
  p_organization_id uuid,
  p_role_context text,
  p_activity_id uuid,
  p_document_role text,
  p_original_filename text,
  p_storage_path text,
  p_sha256 text,
  p_mime_type text,
  p_file_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_actor uuid:=auth.uid(); v_id uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'activity.fill_submit') then
    raise exception using errcode='42501',message='Active role context cannot register intake documents.';
  end if;
  if not (public.current_role_has_permission(p_organization_id,p_role_context,'activity.view.all') or public.current_user_is_assigned_activity(p_activity_id)) then
    raise exception using errcode='42501',message='User is not assigned or authorized for this activity.';
  end if;
  insert into public.intake_documents(organization_id,activity_id,document_role,original_filename,storage_path,sha256,mime_type,file_size_bytes,uploaded_by)
  values(p_organization_id,p_activity_id,p_document_role,p_original_filename,p_storage_path,p_sha256,p_mime_type,p_file_size_bytes,v_actor)
  returning id into v_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'activity.intake_document_registered','activity',p_activity_id,null,
    jsonb_build_object('document_id',v_id,'role',p_document_role,'sha256',p_sha256),null,null,null);
  return v_id;
end;
$$;
revoke all on function public.register_intake_document_command(uuid,text,uuid,text,text,text,text,text,bigint) from public;
grant execute on function public.register_intake_document_command(uuid,text,uuid,text,text,text,text,text,bigint) to authenticated;

create or replace function public.complete_extraction_run_command(
  p_organization_id uuid,
  p_role_context text,
  p_activity_id uuid,
  p_document_id uuid,
  p_engine text,
  p_fields jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_actor uuid:=auth.uid(); v_run_id uuid; v_field jsonb;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'activity.fill_submit') then
    raise exception using errcode='42501',message='Active role context cannot run extraction.';
  end if;
  if not (public.current_role_has_permission(p_organization_id,p_role_context,'activity.view.all') or public.current_user_is_assigned_activity(p_activity_id)) then
    raise exception using errcode='42501',message='User is not assigned or authorized for this activity.';
  end if;
  if not exists(select 1 from public.intake_documents d where d.id=p_document_id and d.activity_id=p_activity_id and d.organization_id=p_organization_id) then
    raise exception using errcode='22023',message='Document does not belong to this activity.';
  end if;
  insert into public.extraction_runs(organization_id,activity_id,document_id,engine,status,created_by,completed_at)
  values(p_organization_id,p_activity_id,p_document_id,p_engine,'COMPLETED',v_actor,now()) returning id into v_run_id;
  for v_field in select * from jsonb_array_elements(coalesce(p_fields,'[]'::jsonb)) loop
    insert into public.extraction_field_results(
      organization_id,extraction_run_id,field_key,raw_value,normalized_value,page_number,confidence,status
    ) values(
      p_organization_id,v_run_id,v_field->>'fieldKey',nullif(v_field->>'rawValue',''),nullif(v_field->>'normalizedValue',''),
      nullif(v_field->>'pageNumber','')::integer,nullif(v_field->>'confidence','')::numeric,coalesce(v_field->>'status','UNCERTAIN')
    );
  end loop;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'activity.pdf_extraction_completed','activity',p_activity_id,null,
    jsonb_build_object('document_id',p_document_id,'extraction_run_id',v_run_id,'engine',p_engine,'fields',jsonb_array_length(coalesce(p_fields,'[]'::jsonb))),null,null,null);
  return v_run_id;
end;
$$;
revoke all on function public.complete_extraction_run_command(uuid,text,uuid,uuid,text,jsonb) from public;
grant execute on function public.complete_extraction_run_command(uuid,text,uuid,uuid,text,jsonb) to authenticated;

create or replace function public.confirm_extraction_field_command(
  p_organization_id uuid,
  p_role_context text,
  p_field_id uuid,
  p_value text,
  p_corrected boolean default false
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_actor uuid:=auth.uid(); v_activity_id uuid;
begin
  select er.activity_id into v_activity_id
  from public.extraction_field_results f join public.extraction_runs er on er.id=f.extraction_run_id
  where f.id=p_field_id and f.organization_id=p_organization_id;
  if v_activity_id is null then raise exception 'Extraction field not found'; end if;
  if not public.current_role_has_permission(p_organization_id,p_role_context,'activity.fill_submit')
     or not (public.current_role_has_permission(p_organization_id,p_role_context,'activity.view.all') or public.current_user_is_assigned_activity(v_activity_id)) then
    raise exception using errcode='42501',message='Active role context cannot confirm extraction.';
  end if;
  update public.extraction_field_results
  set normalized_value=nullif(trim(p_value),''),status=case when p_corrected then 'CORRECTED' else 'CONFIRMED' end,
      confirmed_by=v_actor,confirmed_at=now()
  where id=p_field_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'activity.extraction_field_confirmed','activity',v_activity_id,null,
    jsonb_build_object('field_id',p_field_id,'corrected',p_corrected),null,null,null);
end;
$$;
revoke all on function public.confirm_extraction_field_command(uuid,text,uuid,text,boolean) from public;
grant execute on function public.confirm_extraction_field_command(uuid,text,uuid,text,boolean) to authenticated;

create or replace function public.apply_confirmed_extraction_command(
  p_organization_id uuid,
  p_role_context text,
  p_activity_id uuid,
  p_extraction_run_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_actor uuid:=auth.uid(); v_profile_id uuid; v_route text;
begin
  if not public.current_role_has_permission(p_organization_id,p_role_context,'activity.fill_submit')
     or not (public.current_role_has_permission(p_organization_id,p_role_context,'activity.view.all') or public.current_user_is_assigned_activity(p_activity_id)) then
    raise exception using errcode='42501',message='Active role context cannot apply extraction.';
  end if;
  if not exists(select 1 from public.extraction_runs er where er.id=p_extraction_run_id and er.activity_id=p_activity_id and er.organization_id=p_organization_id) then
    raise exception 'Extraction run not found for activity';
  end if;
  select case when exists(select 1 from public.activity_intake_profiles where activity_id=p_activity_id) then 'HYBRID' else 'PDF' end into v_route;
  insert into public.activity_intake_profiles(organization_id,activity_id,intake_route,specialty,target_audience,learning_gap,aim_and_outcomes,learning_methods,participant_evaluation_method,scfhs_registration_number,created_by,updated_by)
  values(
    p_organization_id,p_activity_id,v_route,
    (select normalized_value from public.extraction_field_results where extraction_run_id=p_extraction_run_id and field_key='specialty' and status in ('CONFIRMED','CORRECTED') limit 1),
    (select normalized_value from public.extraction_field_results where extraction_run_id=p_extraction_run_id and field_key='targetAudience' and status in ('CONFIRMED','CORRECTED') limit 1),
    (select normalized_value from public.extraction_field_results where extraction_run_id=p_extraction_run_id and field_key='learningGap' and status in ('CONFIRMED','CORRECTED') limit 1),
    (select normalized_value from public.extraction_field_results where extraction_run_id=p_extraction_run_id and field_key='aimAndOutcomes' and status in ('CONFIRMED','CORRECTED') limit 1),
    (select normalized_value from public.extraction_field_results where extraction_run_id=p_extraction_run_id and field_key='learningMethods' and status in ('CONFIRMED','CORRECTED') limit 1),
    (select normalized_value from public.extraction_field_results where extraction_run_id=p_extraction_run_id and field_key='participantEvaluationMethod' and status in ('CONFIRMED','CORRECTED') limit 1),
    (select normalized_value from public.extraction_field_results where extraction_run_id=p_extraction_run_id and field_key='scfhsRegistrationNumber' and status in ('CONFIRMED','CORRECTED') limit 1),
    v_actor,v_actor
  )
  on conflict(activity_id) do update set
    intake_route='HYBRID',
    specialty=coalesce(excluded.specialty,activity_intake_profiles.specialty),
    target_audience=coalesce(excluded.target_audience,activity_intake_profiles.target_audience),
    learning_gap=coalesce(excluded.learning_gap,activity_intake_profiles.learning_gap),
    aim_and_outcomes=coalesce(excluded.aim_and_outcomes,activity_intake_profiles.aim_and_outcomes),
    learning_methods=coalesce(excluded.learning_methods,activity_intake_profiles.learning_methods),
    participant_evaluation_method=coalesce(excluded.participant_evaluation_method,activity_intake_profiles.participant_evaluation_method),
    scfhs_registration_number=coalesce(excluded.scfhs_registration_number,activity_intake_profiles.scfhs_registration_number),
    updated_by=v_actor
  returning id into v_profile_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'activity.confirmed_extraction_applied','activity',p_activity_id,null,
    jsonb_build_object('extraction_run_id',p_extraction_run_id,'profile_id',v_profile_id),null,null,null);
  return v_profile_id;
end;
$$;
revoke all on function public.apply_confirmed_extraction_command(uuid,text,uuid,uuid) from public;
grant execute on function public.apply_confirmed_extraction_command(uuid,text,uuid,uuid) to authenticated;

-- Structured digital content is written through the governed command, not directly by tenant users.
revoke insert,update,delete on public.activity_intake_profiles,public.activity_needs_assessment_tools,public.activity_learning_objectives,
  public.activity_scientific_committees,public.activity_scientific_committee_members,public.activity_speakers,public.activity_sessions,
  public.session_speakers,public.disclosure_records from authenticated;
