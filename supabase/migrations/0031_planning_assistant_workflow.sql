-- Human-in-the-loop Planning Assistant. Suggestions never write official activity data until explicit ACCEPT/EDIT_ACCEPT.

alter table public.ai_suggestions
  add column if not exists target_entity_type text,
  add column if not exists target_entity_id uuid,
  add column if not exists suggestion_origin text not null default 'DETERMINISTIC' check(suggestion_origin in ('DETERMINISTIC','EXTERNAL_AI'));

create or replace function public.create_planning_suggestion_command(
  p_organization_id uuid,p_role_context text,p_activity_id uuid,p_suggestion_type text,p_target_entity_type text,p_target_entity_id uuid,p_source_text text,p_suggested_text text,p_origin text default 'DETERMINISTIC'
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id uuid; v_state text;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'ai.run_prereview') then raise exception using errcode='42501',message='Not authorized to use Planning Assistant'; end if;
  if not public.can_edit_activity_intake(p_organization_id,p_activity_id) then raise exception using errcode='42501',message='Activity is not editable by current user'; end if;
  select internal_state into v_state from public.activities where id=p_activity_id and organization_id=p_organization_id;
  if v_state not in ('CREATED','PLANNING_DRAFT','PRE_REVIEW','RETURNED_FOR_CORRECTION') then raise exception using errcode='22023',message='Planning suggestions cannot be created after committee submission'; end if;
  if p_suggestion_type not in ('GAP_STATEMENT','SMART_OBJECTIVE','BLOOM_REVIEW','DOMAIN_CLASSIFICATION','METHOD_ALIGNMENT','EVALUATION_ALIGNMENT') then raise exception using errcode='22023',message='Invalid suggestion type'; end if;
  if p_origin not in ('DETERMINISTIC','EXTERNAL_AI') then raise exception using errcode='22023',message='Invalid suggestion origin'; end if;
  if p_origin='EXTERNAL_AI' and not exists(select 1 from public.organization_ai_settings where organization_id=p_organization_id and external_ai_enabled=true and privacy_approved=true and provider is not null and processing_region is not null) then raise exception using errcode='42501',message='External AI is disabled by organization privacy policy'; end if;
  if nullif(trim(p_suggested_text),'') is null then raise exception using errcode='22023',message='Suggested text is required'; end if;
  if p_target_entity_type='OBJECTIVE' and not exists(select 1 from public.activity_learning_objectives where id=p_target_entity_id and organization_id=p_organization_id and activity_id=p_activity_id) then raise exception using errcode='22023',message='Objective target not found'; end if;
  if p_target_entity_type='GAP' and not exists(select 1 from public.activity_intake_profiles where activity_id=p_activity_id and organization_id=p_organization_id) then raise exception using errcode='22023',message='Activity intake profile not found'; end if;

  insert into public.ai_suggestions(organization_id,activity_id,suggestion_type,source_text,suggested_text,status,created_by,target_entity_type,target_entity_id,suggestion_origin)
  values(p_organization_id,p_activity_id,p_suggestion_type,p_source_text,p_suggested_text,'PROPOSED',v_actor,p_target_entity_type,p_target_entity_id,p_origin)
  returning id into v_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'ai.planning_suggestion_created','ai_suggestion',v_id,null,jsonb_build_object('activity_id',p_activity_id,'type',p_suggestion_type,'origin',p_origin,'target_entity_type',p_target_entity_type),null,null,null);
  return v_id;
end $$;
revoke all on function public.create_planning_suggestion_command(uuid,text,uuid,text,text,uuid,text,text,text) from public;
grant execute on function public.create_planning_suggestion_command(uuid,text,uuid,text,text,uuid,text,text,text) to authenticated;

create or replace function public.act_on_planning_suggestion_command(p_organization_id uuid,p_role_context text,p_suggestion_id uuid,p_action text,p_accepted_text text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v public.ai_suggestions%rowtype; v_final text; v_state text;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'ai.run_prereview') then raise exception using errcode='42501',message='Not authorized'; end if;
  select * into v from public.ai_suggestions where id=p_suggestion_id and organization_id=p_organization_id for update;
  if v.id is null or v.status<>'PROPOSED' then raise exception using errcode='22023',message='Open planning suggestion not found'; end if;
  if not public.can_edit_activity_intake(p_organization_id,v.activity_id) then raise exception using errcode='42501',message='Activity is not editable by current user'; end if;
  select internal_state into v_state from public.activities where id=v.activity_id and organization_id=p_organization_id;
  if v_state not in ('CREATED','PLANNING_DRAFT','PRE_REVIEW','RETURNED_FOR_CORRECTION') then raise exception using errcode='22023',message='Planning suggestion cannot be applied after committee submission'; end if;
  if p_action not in ('ACCEPT','EDIT_ACCEPT','REJECT') then raise exception using errcode='22023',message='Invalid action'; end if;

  if p_action='REJECT' then
    update public.ai_suggestions set status='REJECTED' where id=v.id;
    insert into public.ai_acceptance_events(organization_id,suggestion_id,action,accepted_text,acted_by,role_context) values(p_organization_id,v.id,'REJECT',null,v_actor,p_role_context);
  else
    v_final:=case when p_action='ACCEPT' then v.suggested_text else nullif(trim(p_accepted_text),'') end;
    if v_final is null then raise exception using errcode='22023',message='Accepted text is required'; end if;
    -- Placeholders are intentionally non-acceptable so the assistant cannot turn missing facts into official content.
    if v_final ~ '\[[^]]+\]' then raise exception using errcode='22023',message='Resolve all bracketed placeholders before accepting the suggestion'; end if;
    if v.target_entity_type='GAP' then
      update public.activity_intake_profiles set learning_gap=v_final,updated_by=v_actor where organization_id=p_organization_id and activity_id=v.activity_id;
    elsif v.target_entity_type='OBJECTIVE' then
      update public.activity_learning_objectives set objective_text=v_final where organization_id=p_organization_id and activity_id=v.activity_id and id=v.target_entity_id;
      if not found then raise exception using errcode='22023',message='Objective target no longer exists'; end if;
    else
      raise exception using errcode='22023',message='Suggestion target is advisory only and cannot write an official field';
    end if;
    update public.ai_suggestions set status=case when p_action='ACCEPT' then 'ACCEPTED' else 'EDITED_ACCEPTED' end where id=v.id;
    insert into public.ai_acceptance_events(organization_id,suggestion_id,action,accepted_text,acted_by,role_context) values(p_organization_id,v.id,case when p_action='ACCEPT' then 'ACCEPT' else 'EDIT_ACCEPT' end,v_final,v_actor,p_role_context);
  end if;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'ai.planning_suggestion_acted','ai_suggestion',v.id,jsonb_build_object('status','PROPOSED'),jsonb_build_object('action',p_action,'accepted_text',case when p_action='REJECT' then null else v_final end),null,null,null);
end $$;
revoke all on function public.act_on_planning_suggestion_command(uuid,text,uuid,text,text) from public;
grant execute on function public.act_on_planning_suggestion_command(uuid,text,uuid,text,text) to authenticated;
