-- Organization user/role administration. Role assignment is audited and remains tenant-scoped.

create or replace function public.list_organization_users_command(p_organization_id uuid,p_role_context text)
returns table(membership_id uuid,user_id uuid,email text,display_name text,membership_status text,role_codes text[])
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'organization.users.manage') then raise exception using errcode='42501',message='Not authorized to manage organization users'; end if;
  return query
  select m.id,u.id,au.email,u.display_name,m.status,coalesce(array_agg(r.code order by r.code) filter(where r.code is not null),array[]::text[])
  from public.organization_memberships m join public.users u on u.id=m.user_id join auth.users au on au.id=u.id
  left join public.user_roles ur on ur.membership_id=m.id and ur.organization_id=m.organization_id left join public.roles r on r.id=ur.role_id
  where m.organization_id=p_organization_id group by m.id,u.id,au.email,u.display_name,m.status order by u.display_name,au.email;
end $$;
revoke all on function public.list_organization_users_command(uuid,text) from public;
grant execute on function public.list_organization_users_command(uuid,text) to authenticated;

create or replace function public.ensure_organization_membership_command(p_organization_id uuid,p_role_context text,p_user_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_membership uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'organization.users.manage') then raise exception using errcode='42501',message='Not authorized'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception using errcode='22023',message='Auth user does not exist'; end if;
  insert into public.users(id,display_name) select id,coalesce(raw_user_meta_data->>'full_name',email,'User') from auth.users where id=p_user_id on conflict(id) do nothing;
  insert into public.organization_memberships(organization_id,user_id,status) values(p_organization_id,p_user_id,'ACTIVE')
  on conflict(organization_id,user_id) do update set status='ACTIVE' returning id into v_membership;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'organization.membership_ensured','organization_membership',v_membership,null,jsonb_build_object('user_id',p_user_id,'status','ACTIVE'),null,null,null);
  return v_membership;
end $$;
revoke all on function public.ensure_organization_membership_command(uuid,text,uuid) from public;
grant execute on function public.ensure_organization_membership_command(uuid,text,uuid) to authenticated;

create or replace function public.set_organization_user_roles_command(p_organization_id uuid,p_role_context text,p_membership_id uuid,p_role_codes text[])
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_user uuid;v_code text;v_before text[];
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'organization.roles.manage') then raise exception using errcode='42501',message='Not authorized to manage roles'; end if;
  select user_id into v_user from public.organization_memberships where id=p_membership_id and organization_id=p_organization_id and status='ACTIVE';
  if v_user is null then raise exception using errcode='22023',message='Active membership not found'; end if;
  select coalesce(array_agg(r.code order by r.code),array[]::text[]) into v_before from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.membership_id=p_membership_id and ur.organization_id=p_organization_id;
  if exists(select 1 from unnest(coalesce(p_role_codes,array[]::text[])) x(code) left join public.roles r on r.code=x.code and r.scope='ORGANIZATION' where r.id is null) then raise exception using errcode='22023',message='Unknown or non-organization role requested'; end if;
  delete from public.user_roles where membership_id=p_membership_id and organization_id=p_organization_id;
  foreach v_code in array coalesce(p_role_codes,array[]::text[]) loop
    insert into public.user_roles(organization_id,membership_id,role_id) select p_organization_id,p_membership_id,id from public.roles where code=v_code and scope='ORGANIZATION';
  end loop;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'organization.roles_changed','organization_membership',p_membership_id,jsonb_build_object('roles',v_before),jsonb_build_object('roles',p_role_codes,'user_id',v_user),null,null,null);
end $$;
revoke all on function public.set_organization_user_roles_command(uuid,text,uuid,text[]) from public;
grant execute on function public.set_organization_user_roles_command(uuid,text,uuid,text[]) to authenticated;

create or replace function public.set_organization_membership_status_command(p_organization_id uuid,p_role_context text,p_membership_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_old text;v_user uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'organization.users.manage') then raise exception using errcode='42501',message='Not authorized'; end if;
  if p_status not in ('ACTIVE','SUSPENDED') then raise exception using errcode='22023',message='Membership status must be ACTIVE or SUSPENDED'; end if;
  select status,user_id into v_old,v_user from public.organization_memberships where id=p_membership_id and organization_id=p_organization_id for update;
  if v_user is null then raise exception using errcode='22023',message='Membership not found'; end if;
  if v_user=v_actor and p_status='SUSPENDED' then raise exception using errcode='22023',message='Administrator cannot suspend the active self membership'; end if;
  update public.organization_memberships set status=p_status where id=p_membership_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'organization.membership_status_changed','organization_membership',p_membership_id,jsonb_build_object('status',v_old),jsonb_build_object('status',p_status,'user_id',v_user),null,null,null);
end $$;
revoke all on function public.set_organization_membership_status_command(uuid,text,uuid,text) from public;
grant execute on function public.set_organization_membership_status_command(uuid,text,uuid,text) to authenticated;
