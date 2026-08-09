-- Fix text speaker keys in the atomic intake command. jsonb_array_elements_text returns text, not jsonb.
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
  v_speaker_key text;
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
      for v_speaker_key in select jsonb_array_elements_text(coalesce(v_session->'speakerKeys','[]'::jsonb)) loop
        select id into v_speaker_id from public.activity_speakers
        where activity_id=p_activity_id and client_key=v_speaker_key limit 1;
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
