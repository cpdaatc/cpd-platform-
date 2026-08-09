create or replace function public.save_pre_review_command(
  p_organization_id uuid,
  p_role_context text,
  p_activity_id uuid,
  p_ruleset_version text,
  p_input_fingerprint text,
  p_findings jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor uuid:=auth.uid();
  v_review_id uuid;
  v_finding jsonb;
  v_rule_version_id uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'ai.run_prereview') then
    raise exception using errcode='42501',message='Active role context cannot run pre-review.';
  end if;
  if not exists(select 1 from public.activities a where a.id=p_activity_id and a.organization_id=p_organization_id) then
    raise exception using errcode='42501',message='Activity is not available in this organization.';
  end if;
  if not (
    public.current_role_has_permission(p_organization_id,p_role_context,'activity.view.all')
    or public.current_user_is_assigned_activity(p_activity_id)
  ) then
    raise exception using errcode='42501',message='User is not assigned or authorized to review this activity.';
  end if;

  insert into public.ai_reviews(
    organization_id,activity_id,review_type,engine_type,ruleset_version,input_fingerprint,run_by,role_context,status,completed_at
  ) values(
    p_organization_id,p_activity_id,'PRE_REVIEW','DETERMINISTIC',p_ruleset_version,p_input_fingerprint,v_actor,p_role_context,'COMPLETED',now()
  ) returning id into v_review_id;

  for v_finding in select * from jsonb_array_elements(coalesce(p_findings,'[]'::jsonb)) loop
    select rv.id into v_rule_version_id
    from public.regulatory_rules r
    join public.rule_versions rv on rv.rule_id=r.id and rv.status='ACTIVE'
    where r.rule_code=v_finding->>'ruleCode' and r.organization_id is null
    order by rv.created_at desc limit 1;

    insert into public.ai_findings(
      organization_id,ai_review_id,rule_version_id,rule_code,source_code,source_version,evidence_location,status,severity,rationale,recommendation,confidence
    ) values(
      p_organization_id,v_review_id,v_rule_version_id,v_finding->>'ruleCode',v_finding->>'sourceCode',v_finding->>'sourceVersion',
      v_finding->>'evidenceLocation',v_finding->>'status',v_finding->>'severity',v_finding->>'rationale',v_finding->>'recommendation',
      coalesce((v_finding->>'confidence')::numeric,1)
    );
  end loop;

  perform public.log_audit_event(
    p_organization_id,v_actor,p_role_context,'activity.pre_review_completed','activity',p_activity_id,null,
    jsonb_build_object('ai_review_id',v_review_id,'engine','DETERMINISTIC','ruleset_version',p_ruleset_version,'finding_count',jsonb_array_length(coalesce(p_findings,'[]'::jsonb))),
    null,null,null
  );
  return v_review_id;
end;
$$;
revoke all on function public.save_pre_review_command(uuid,text,uuid,text,text,jsonb) from public;
grant execute on function public.save_pre_review_command(uuid,text,uuid,text,text,jsonb) to authenticated;

create or replace function public.resolve_source_conflict_command(
  p_organization_id uuid,
  p_role_context text,
  p_conflict_id uuid,
  p_resolution text,
  p_selected_source_document_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_resolution_id uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'ai.resolve_source_conflict') then
    raise exception using errcode='42501',message='Active role context cannot resolve source conflicts.';
  end if;
  if nullif(trim(p_resolution),'') is null then
    raise exception using errcode='22023',message='Resolution rationale is required.';
  end if;
  if not exists(select 1 from public.source_conflicts where id=p_conflict_id and organization_id=p_organization_id and status='OPEN') then
    raise exception using errcode='22023',message='Open source conflict not found.';
  end if;

  insert into public.source_conflict_resolutions(
    organization_id,conflict_id,resolution,selected_source_document_id,resolved_by
  ) values(
    p_organization_id,p_conflict_id,trim(p_resolution),p_selected_source_document_id,v_actor
  ) returning id into v_resolution_id;

  update public.source_conflicts set status='RESOLVED' where id=p_conflict_id;

  perform public.log_audit_event(
    p_organization_id,v_actor,p_role_context,'rules.source_conflict_resolved','source_conflict',p_conflict_id,null,
    jsonb_build_object('resolution_id',v_resolution_id,'selected_source_document_id',p_selected_source_document_id),null,null,null
  );
  return v_resolution_id;
end;
$$;
revoke all on function public.resolve_source_conflict_command(uuid,text,uuid,text,uuid) from public;
grant execute on function public.resolve_source_conflict_command(uuid,text,uuid,text,uuid) to authenticated;
