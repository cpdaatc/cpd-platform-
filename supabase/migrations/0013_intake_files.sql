-- Governed file registration for per-activity speaker CVs and supporting evidence.

create or replace function public.register_activity_speaker_document_command(
  p_organization_id uuid,
  p_role_context text,
  p_activity_speaker_id uuid,
  p_document_type text,
  p_storage_path text,
  p_sha256 text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor uuid:=auth.uid();
  v_activity_id uuid;
  v_id uuid;
  v_version integer;
begin
  select activity_id into v_activity_id from public.activity_speakers
  where id=p_activity_speaker_id and organization_id=p_organization_id;
  if v_activity_id is null then raise exception 'Activity speaker not found'; end if;
  if not public.current_role_has_permission(p_organization_id,p_role_context,'activity.fill_submit')
     or not (public.current_role_has_permission(p_organization_id,p_role_context,'activity.view.all') or public.current_user_is_assigned_activity(v_activity_id)) then
    raise exception using errcode='42501',message='Active role context cannot register speaker documents.';
  end if;
  select coalesce(max(version_no),0)+1 into v_version from public.activity_speaker_documents
  where activity_speaker_id=p_activity_speaker_id and document_type=p_document_type;
  insert into public.activity_speaker_documents(organization_id,activity_speaker_id,document_type,storage_path,sha256,version_no,uploaded_by)
  values(p_organization_id,p_activity_speaker_id,p_document_type,p_storage_path,p_sha256,v_version,v_actor)
  returning id into v_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'activity.speaker_document_registered','activity',v_activity_id,null,
    jsonb_build_object('activity_speaker_id',p_activity_speaker_id,'document_id',v_id,'document_type',p_document_type,'version',v_version,'sha256',p_sha256),null,null,null);
  return v_id;
end;
$$;
revoke all on function public.register_activity_speaker_document_command(uuid,text,uuid,text,text,text) from public;
grant execute on function public.register_activity_speaker_document_command(uuid,text,uuid,text,text,text) to authenticated;

create or replace function public.register_activity_evidence_command(
  p_organization_id uuid,
  p_role_context text,
  p_activity_id uuid,
  p_evidence_type text,
  p_storage_path text,
  p_sha256 text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_actor uuid:=auth.uid(); v_id uuid;
begin
  if not public.current_role_has_permission(p_organization_id,p_role_context,'activity.fill_submit')
     or not (public.current_role_has_permission(p_organization_id,p_role_context,'activity.view.all') or public.current_user_is_assigned_activity(p_activity_id)) then
    raise exception using errcode='42501',message='Active role context cannot register evidence.';
  end if;
  insert into public.activity_evidence(organization_id,activity_id,evidence_type,status,storage_path,sha256,notes,created_by)
  values(p_organization_id,p_activity_id,p_evidence_type,'UPLOADED',p_storage_path,p_sha256,p_notes,v_actor)
  returning id into v_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'activity.evidence_uploaded','activity',p_activity_id,null,
    jsonb_build_object('evidence_id',v_id,'evidence_type',p_evidence_type,'sha256',p_sha256),null,null,null);
  return v_id;
end;
$$;
revoke all on function public.register_activity_evidence_command(uuid,text,uuid,text,text,text,text) from public;
grant execute on function public.register_activity_evidence_command(uuid,text,uuid,text,text,text,text) to authenticated;

-- Direct insert is removed: uploads must be registered through governed commands.
revoke insert on public.activity_speaker_documents from authenticated;
revoke insert,update,delete on public.activity_evidence from authenticated;
