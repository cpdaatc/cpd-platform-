-- Private reference source file registry. Source files live in tenant storage, never in the public code repository.

alter table public.reference_documents
  add column if not exists source_storage_path text,
  add column if not exists source_sha256 text,
  add column if not exists source_mime_type text,
  add column if not exists source_file_size_bytes bigint,
  add column if not exists page_count integer,
  add column if not exists uploaded_by uuid references public.users(id),
  add column if not exists verified_at timestamptz;

alter table public.reference_documents
  add constraint reference_documents_source_sha256_check check(source_sha256 is null or source_sha256 ~ '^[0-9a-fA-F]{64}$'),
  add constraint reference_documents_file_size_check check(source_file_size_bytes is null or source_file_size_bytes>=0),
  add constraint reference_documents_page_count_check check(page_count is null or page_count>0);

create or replace function public.register_reference_document_command(
  p_organization_id uuid,
  p_role_context text,
  p_source_code text,
  p_title text,
  p_source_type text,
  p_authority_level integer,
  p_version_label text,
  p_effective_from date,
  p_effective_to date,
  p_source_uri text,
  p_storage_path text,
  p_sha256 text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_page_count integer default null
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'ai.manage_references') then
    raise exception using errcode='42501',message='Active role context cannot manage reference sources.';
  end if;
  if p_source_type not in ('REGULATORY','ACCREDITATION_STANDARD','OPERATIONAL_GUIDANCE','ETHICS','EDUCATIONAL_GUIDANCE','INTERNAL_POLICY') then
    raise exception using errcode='22023',message='Invalid reference source type.';
  end if;
  if p_authority_level not between 1 and 5 then raise exception using errcode='22023',message='Authority level must be 1-5.'; end if;
  if nullif(trim(p_source_code),'') is null or nullif(trim(p_title),'') is null or nullif(trim(p_version_label),'') is null then raise exception using errcode='22023',message='Source code, title and version are required.'; end if;
  if nullif(trim(p_storage_path),'') is null or p_storage_path not like p_organization_id::text||'/%' then raise exception using errcode='22023',message='Reference file must be stored under the tenant path.'; end if;
  if p_sha256 !~ '^[0-9a-fA-F]{64}$' then raise exception using errcode='22023',message='Valid SHA-256 is required.'; end if;
  if p_effective_to is not null and p_effective_from is not null and p_effective_to<p_effective_from then raise exception using errcode='22023',message='Effective-to cannot precede effective-from.'; end if;

  insert into public.reference_documents(
    organization_id,source_code,title,source_type,authority_level,version_label,effective_from,effective_to,status,source_uri,checksum,is_global,created_by,
    source_storage_path,source_sha256,source_mime_type,source_file_size_bytes,page_count,uploaded_by,verified_at
  ) values(
    p_organization_id,trim(p_source_code),trim(p_title),p_source_type,p_authority_level,trim(p_version_label),p_effective_from,p_effective_to,'ACTIVE',nullif(trim(p_source_uri),''),lower(p_sha256),false,v_actor,
    trim(p_storage_path),lower(p_sha256),p_mime_type,p_file_size_bytes,p_page_count,v_actor,now()
  ) returning id into v_id;

  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'reference.document_registered','reference_document',v_id,null,
    jsonb_build_object('source_code',p_source_code,'version',p_version_label,'sha256',lower(p_sha256),'storage_path',p_storage_path,'source_type',p_source_type,'authority_level',p_authority_level),null,null,null);
  return v_id;
end $$;
revoke all on function public.register_reference_document_command(uuid,text,text,text,text,integer,text,date,date,text,text,text,text,bigint,integer) from public;
grant execute on function public.register_reference_document_command(uuid,text,text,text,text,integer,text,date,date,text,text,text,text,bigint,integer) to authenticated;
