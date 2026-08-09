-- Harden the SECURITY DEFINER audit RPC so an authenticated caller cannot
-- spoof another user, organization, or role context. Trusted service-role
-- calls may operate without auth.uid(); the service key is server-only.

create or replace function public.log_audit_event(
  p_organization_id uuid,
  p_user_id uuid,
  p_role_context text,
  p_action text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_before_json jsonb default null,
  p_after_json jsonb default null,
  p_ip_address inet default null,
  p_user_agent text default null,
  p_request_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_auth_user uuid := auth.uid();
begin
  if v_auth_user is not null then
    if p_organization_id is null then
      raise exception using errcode='42501', message='Tenant audit events require an organization context.';
    end if;

    if p_user_id is distinct from v_auth_user then
      raise exception using errcode='42501', message='Audit actor cannot be spoofed.';
    end if;

    if not exists (
      select 1
      from public.organization_memberships m
      join public.user_roles ur
        on ur.membership_id = m.id
       and ur.organization_id = m.organization_id
      join public.roles r on r.id = ur.role_id
      where m.organization_id = p_organization_id
        and m.user_id = v_auth_user
        and m.status = 'ACTIVE'
        and r.code = p_role_context
    ) then
      raise exception using errcode='42501', message='Audit organization or role context is not authorized for this user.';
    end if;
  end if;

  insert into public.audit_logs(
    organization_id,
    user_id,
    role_context,
    action,
    entity_type,
    entity_id,
    before_json,
    after_json,
    ip_address,
    user_agent,
    request_id
  ) values (
    p_organization_id,
    p_user_id,
    p_role_context,
    p_action,
    p_entity_type,
    p_entity_id,
    p_before_json,
    p_after_json,
    p_ip_address,
    p_user_agent,
    p_request_id
  )
  returning event_id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.log_audit_event(uuid,uuid,text,text,text,uuid,jsonb,jsonb,inet,text,text) from public;
grant execute on function public.log_audit_event(uuid,uuid,text,text,text,uuid,jsonb,jsonb,inet,text,text) to authenticated, service_role;
