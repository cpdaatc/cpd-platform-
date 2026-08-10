-- Human source-conflict resolution. The platform never silently selects a regulatory source.

create or replace function public.resolve_source_conflict_command(p_organization_id uuid,p_role_context text,p_conflict_id uuid,p_selected_source_document_id uuid,p_resolution text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_a uuid;v_b uuid;v_status text;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'ai.resolve_source_conflict') then raise exception using errcode='42501',message='Not authorized to resolve source conflicts'; end if;
  select source_document_a_id,source_document_b_id,status into v_a,v_b,v_status from public.source_conflicts where id=p_conflict_id and organization_id=p_organization_id for update;
  if v_status is null then raise exception using errcode='22023',message='Source conflict not found'; end if;
  if v_status<>'OPEN' then raise exception using errcode='22023',message='Source conflict is not open'; end if;
  if p_selected_source_document_id is not null and p_selected_source_document_id not in (v_a,v_b) then raise exception using errcode='22023',message='Selected source must be one of the conflicting sources'; end if;
  if nullif(trim(p_resolution),'') is null then raise exception using errcode='22023',message='Resolution rationale is required'; end if;
  insert into public.source_conflict_resolutions(organization_id,conflict_id,resolution,selected_source_document_id,resolved_by) values(p_organization_id,p_conflict_id,trim(p_resolution),p_selected_source_document_id,v_actor);
  update public.source_conflicts set status='RESOLVED' where id=p_conflict_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'reference.source_conflict_resolved','source_conflict',p_conflict_id,jsonb_build_object('status','OPEN'),jsonb_build_object('status','RESOLVED','selected_source_document_id',p_selected_source_document_id,'resolution',p_resolution),null,null,null);
end $$;
revoke all on function public.resolve_source_conflict_command(uuid,text,uuid,uuid,text) from public;
grant execute on function public.resolve_source_conflict_command(uuid,text,uuid,uuid,text) to authenticated;
