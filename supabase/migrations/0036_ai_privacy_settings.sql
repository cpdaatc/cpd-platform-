-- External AI provider configuration is separate from privacy approval.
-- Organization System Admin may configure/disable; only Management Approver may enable after explicit approval.

insert into public.permissions(code,description) values
  ('ai.settings.configure','Configure external AI provider/region while keeping external AI disabled'),
  ('ai.settings.approve','Approve privacy and enable an explicitly configured external AI provider')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='ORGANIZATION_SYSTEM_ADMIN' and p.code='ai.settings.configure'
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='MANAGEMENT_APPROVER' and p.code='ai.settings.approve'
on conflict do nothing;

alter table public.organization_ai_settings
  add column if not exists last_configured_by uuid references public.users(id),
  add column if not exists last_configured_at timestamptz,
  add column if not exists privacy_approval_reference text,
  add column if not exists privacy_approval_note text;

create or replace function public.configure_external_ai_command(
  p_organization_id uuid,p_role_context text,p_provider text,p_processing_region text,p_retention_policy text
)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'ai.settings.configure') then raise exception using errcode='42501',message='Not authorized to configure external AI'; end if;
  if nullif(trim(p_provider),'') is null or nullif(trim(p_processing_region),'') is null then raise exception using errcode='22023',message='Provider and processing region are required'; end if;
  insert into public.organization_ai_settings(organization_id,external_ai_enabled,privacy_approved,provider,processing_region,retention_policy,approved_by,approved_at,last_configured_by,last_configured_at,privacy_approval_reference,privacy_approval_note)
  values(p_organization_id,false,false,trim(p_provider),trim(p_processing_region),nullif(trim(p_retention_policy),''),null,null,v_actor,now(),null,null)
  on conflict(organization_id) do update set external_ai_enabled=false,privacy_approved=false,provider=excluded.provider,processing_region=excluded.processing_region,retention_policy=excluded.retention_policy,approved_by=null,approved_at=null,last_configured_by=v_actor,last_configured_at=now(),privacy_approval_reference=null,privacy_approval_note=null;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'ai.provider_configured','organization_ai_settings',p_organization_id,null,jsonb_build_object('provider',trim(p_provider),'processing_region',trim(p_processing_region),'retention_policy',p_retention_policy,'external_ai_enabled',false,'privacy_approved',false),null,null,null);
end $$;
revoke all on function public.configure_external_ai_command(uuid,text,text,text,text) from public;
grant execute on function public.configure_external_ai_command(uuid,text,text,text,text) to authenticated;

create or replace function public.approve_external_ai_command(
  p_organization_id uuid,p_role_context text,p_approval_reference text,p_approval_note text default null
)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_provider text;v_region text;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'ai.settings.approve') then raise exception using errcode='42501',message='Management privacy approval is required'; end if;
  select provider,processing_region into v_provider,v_region from public.organization_ai_settings where organization_id=p_organization_id for update;
  if nullif(trim(v_provider),'') is null or nullif(trim(v_region),'') is null then raise exception using errcode='22023',message='Provider and processing region must be configured first'; end if;
  if nullif(trim(p_approval_reference),'') is null then raise exception using errcode='22023',message='Privacy approval reference is required'; end if;
  update public.organization_ai_settings set external_ai_enabled=true,privacy_approved=true,approved_by=v_actor,approved_at=now(),privacy_approval_reference=trim(p_approval_reference),privacy_approval_note=nullif(trim(p_approval_note),'') where organization_id=p_organization_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'ai.privacy_approved_and_enabled','organization_ai_settings',p_organization_id,null,jsonb_build_object('provider',v_provider,'processing_region',v_region,'approval_reference',trim(p_approval_reference)),null,null,null);
end $$;
revoke all on function public.approve_external_ai_command(uuid,text,text,text) from public;
grant execute on function public.approve_external_ai_command(uuid,text,text,text) to authenticated;

create or replace function public.disable_external_ai_command(p_organization_id uuid,p_role_context text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not (public.current_role_has_permission(p_organization_id,p_role_context,'ai.settings.configure') or public.current_role_has_permission(p_organization_id,p_role_context,'ai.settings.approve')) then raise exception using errcode='42501',message='Not authorized to disable external AI'; end if;
  if nullif(trim(p_reason),'') is null then raise exception using errcode='22023',message='Disable reason is required'; end if;
  update public.organization_ai_settings set external_ai_enabled=false where organization_id=p_organization_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'ai.external_disabled','organization_ai_settings',p_organization_id,null,jsonb_build_object('reason',trim(p_reason)),null,null,null);
end $$;
revoke all on function public.disable_external_ai_command(uuid,text,text) from public;
grant execute on function public.disable_external_ai_command(uuid,text,text) to authenticated;
