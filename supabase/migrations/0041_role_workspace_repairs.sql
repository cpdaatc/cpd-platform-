-- Repair the organization-user listing result contract discovered by full-role browser UAT.
-- auth.users.email is varchar while the governed RPC contract intentionally returns text.

create or replace function public.list_organization_users_command(p_organization_id uuid,p_role_context text)
returns table(membership_id uuid,user_id uuid,email text,display_name text,membership_status text,role_codes text[])
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'organization.users.manage') then raise exception using errcode='42501',message='Not authorized to manage organization users'; end if;
  return query
  select m.id,u.id,au.email::text,u.display_name,m.status,coalesce(array_agg(r.code order by r.code) filter(where r.code is not null),array[]::text[])
  from public.organization_memberships m join public.users u on u.id=m.user_id join auth.users au on au.id=u.id
  left join public.user_roles ur on ur.membership_id=m.id and ur.organization_id=m.organization_id left join public.roles r on r.id=ur.role_id
  where m.organization_id=p_organization_id group by m.id,u.id,au.email,u.display_name,m.status order by u.display_name,au.email;
end $$;
revoke all on function public.list_organization_users_command(uuid,text) from public;
grant execute on function public.list_organization_users_command(uuid,text) to authenticated;
