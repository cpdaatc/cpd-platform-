insert into public.permissions(code,description) values
  ('ai.settings.configure','Configure proposed external AI provider and processing region'),
  ('ai.privacy.approve','Approve or revoke organization external AI privacy use')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='ORGANIZATION_SYSTEM_ADMIN' and p.code='ai.settings.configure'
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='MANAGEMENT_APPROVER' and p.code='ai.privacy.approve'
on conflict do nothing;

drop policy if exists organization_ai_settings_write on public.organization_ai_settings;
revoke update on public.organization_ai_settings from authenticated;

create or replace function public.configure_external_ai_command(
  p_organization_id uuid,
  p_role_context text,
  p_provider text,
  p_processing_region text,
  p_retention_policy text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'ai.settings.configure') then
    raise exception using errcode='42501',message='Active role context cannot configure AI settings.';
  end if;
  insert into public.organization_ai_settings(organization_id,external_ai_enabled,privacy_approved,provider,processing_region,retention_policy,approved_by,approved_at,updated_at)
  values(p_organization_id,false,false,nullif(trim(p_provider),''),nullif(trim(p_processing_region),''),nullif(trim(p_retention_policy),''),null,null,now())
  on conflict(organization_id) do update set
    external_ai_enabled=false,
    privacy_approved=false,
    provider=excluded.provider,
    processing_region=excluded.processing_region,
    retention_policy=excluded.retention_policy,
    approved_by=null,
    approved_at=null,
    updated_at=now();
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'ai.settings_configured','organization',p_organization_id,null,
    jsonb_build_object('provider',nullif(trim(p_provider),''),'processing_region',nullif(trim(p_processing_region),''),'external_ai_enabled',false),null,null,null);
end;
$$;
revoke all on function public.configure_external_ai_command(uuid,text,text,text,text) from public;
grant execute on function public.configure_external_ai_command(uuid,text,text,text,text) to authenticated;

create or replace function public.approve_external_ai_privacy_command(
  p_organization_id uuid,
  p_role_context text,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_provider text;
  v_region text;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'ai.privacy.approve') then
    raise exception using errcode='42501',message='Active role context cannot approve external AI privacy use.';
  end if;
  select provider,processing_region into v_provider,v_region
  from public.organization_ai_settings where organization_id=p_organization_id for update;
  if p_approve and (v_provider is null or v_region is null) then
    raise exception using errcode='22023',message='Provider and processing region must be configured before privacy approval.';
  end if;
  update public.organization_ai_settings
  set privacy_approved=p_approve,
      external_ai_enabled=p_approve,
      approved_by=case when p_approve then v_actor else null end,
      approved_at=case when p_approve then now() else null end,
      updated_at=now()
  where organization_id=p_organization_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,
    case when p_approve then 'ai.privacy_approved' else 'ai.privacy_revoked' end,
    'organization',p_organization_id,null,jsonb_build_object('external_ai_enabled',p_approve),null,null,null);
end;
$$;
revoke all on function public.approve_external_ai_privacy_command(uuid,text,boolean) from public;
grant execute on function public.approve_external_ai_privacy_command(uuid,text,boolean) to authenticated;
