-- Tenant isolation and permission-aware RLS for Phase 1.
-- Complex membership checks live in SECURITY DEFINER helpers to avoid recursive RLS
-- and are wrapped in SELECT by policies for Postgres/Supabase performance.

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
  );
$$;

create or replace function public.current_membership_id(p_organization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.organization_memberships m
  where m.organization_id = p_organization_id
    and m.user_id = (select auth.uid())
    and m.status = 'ACTIVE'
  limit 1;
$$;

create or replace function public.current_user_has_permission(
  p_organization_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    join public.user_roles ur
      on ur.membership_id = m.id
     and ur.organization_id = m.organization_id
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and p.code = p_permission_code
  );
$$;

create or replace function public.current_user_is_assigned_activity(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.activity_assignments aa
    join public.organization_memberships m
      on m.id = aa.membership_id
     and m.organization_id = aa.organization_id
    where aa.activity_id = p_activity_id
      and aa.is_active = true
      and m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.current_membership_id(uuid) from public;
revoke all on function public.current_user_has_permission(uuid,text) from public;
revoke all on function public.current_user_is_assigned_activity(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.current_membership_id(uuid) to authenticated, service_role;
grant execute on function public.current_user_has_permission(uuid,text) to authenticated, service_role;
grant execute on function public.current_user_is_assigned_activity(uuid) to authenticated, service_role;

-- Base table privileges. RLS remains the data boundary.
grant select on public.organizations to authenticated;
grant select on public.users to authenticated;
grant select on public.organization_memberships to authenticated;
grant select on public.roles, public.permissions, public.role_permissions to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.departments to authenticated;
grant select, insert, update on public.activities to authenticated;
grant select, insert, update on public.activity_assignments to authenticated;
grant select on public.activity_status_history to authenticated;
grant select on public.audit_logs to authenticated;

-- Organization membership boundary.
alter table public.organizations enable row level security;
create policy organizations_select_member
on public.organizations for select to authenticated
using ((select public.is_org_member(id)));

alter table public.organization_memberships enable row level security;
create policy memberships_select_self_or_manager
on public.organization_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.current_user_has_permission(organization_id, 'organization.users.manage'))
);

-- User profiles are global identities, not tenant business rows. A user can see self,
-- or profiles sharing an active organization membership; this avoids leaking unrelated users.
alter table public.users enable row level security;
create policy users_select_self_or_shared_org
on public.users for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.organization_memberships target_m
    where target_m.user_id = users.id
      and target_m.status = 'ACTIVE'
      and (select public.is_org_member(target_m.organization_id))
  )
);

-- Canonical roles/permissions are readable reference data, never writable by tenant users.
alter table public.roles enable row level security;
create policy roles_read_authenticated
on public.roles for select to authenticated using (true);

alter table public.permissions enable row level security;
create policy permissions_read_authenticated
on public.permissions for select to authenticated using (true);

alter table public.role_permissions enable row level security;
create policy role_permissions_read_authenticated
on public.role_permissions for select to authenticated using (true);

alter table public.user_roles enable row level security;
create policy user_roles_select_self_or_manager
on public.user_roles for select to authenticated
using (
  membership_id = (select public.current_membership_id(organization_id))
  or (select public.current_user_has_permission(organization_id, 'organization.roles.manage'))
);

alter table public.departments enable row level security;
create policy departments_select_org_member
on public.departments for select to authenticated
using ((select public.is_org_member(organization_id)));

-- Activity master: organization-wide readers use activity.view.all;
-- Activity Officers use assignment-scoped activity.view.assigned.
alter table public.activities enable row level security;
create policy activities_select_authorized
on public.activities for select to authenticated
using (
  (select public.current_user_has_permission(organization_id, 'activity.view.all'))
  or (
    (select public.current_user_has_permission(organization_id, 'activity.view.assigned'))
    and (select public.current_user_is_assigned_activity(id))
  )
);

create policy activities_insert_admin
on public.activities for insert to authenticated
with check (
  (select public.is_org_member(organization_id))
  and (select public.current_user_has_permission(organization_id, 'activity.create'))
  and created_by = (select auth.uid())
);

create policy activities_update_admin
on public.activities for update to authenticated
using (
  (select public.is_org_member(organization_id))
  and (select public.current_user_has_permission(organization_id, 'activity.create'))
)
with check (
  (select public.is_org_member(organization_id))
  and (select public.current_user_has_permission(organization_id, 'activity.create'))
);

alter table public.activity_assignments enable row level security;
create policy assignments_select_manager_or_self
on public.activity_assignments for select to authenticated
using (
  (select public.current_user_has_permission(organization_id, 'activity.assign'))
  or membership_id = (select public.current_membership_id(organization_id))
);

create policy assignments_insert_manager
on public.activity_assignments for insert to authenticated
with check (
  (select public.is_org_member(organization_id))
  and (select public.current_user_has_permission(organization_id, 'activity.assign'))
  and assigned_by = (select auth.uid())
);

create policy assignments_update_manager
on public.activity_assignments for update to authenticated
using (
  (select public.current_user_has_permission(organization_id, 'activity.assign'))
)
with check (
  (select public.current_user_has_permission(organization_id, 'activity.assign'))
);

alter table public.activity_status_history enable row level security;
create policy status_history_select_authorized_activity
on public.activity_status_history for select to authenticated
using (
  exists (
    select 1 from public.activities a where a.id = activity_status_history.activity_id
  )
);

-- Audit is read-only to tenant users with audit.view. Writes go through the audited RPC.
alter table public.audit_logs enable row level security;
create policy audit_logs_select_authorized
on public.audit_logs for select to authenticated
using (
  organization_id is not null
  and (select public.current_user_has_permission(organization_id, 'audit.view'))
);

-- No authenticated policies are created for audit_hash_anchors in Phase 1.
alter table public.audit_hash_anchors enable row level security;

-- Restrict audit RPC to authenticated callers and ensure they cannot claim another tenant.
revoke all on function public.log_audit_event(uuid,uuid,text,text,text,uuid,jsonb,jsonb,inet,text,text) from public;
grant execute on function public.log_audit_event(uuid,uuid,text,text,text,uuid,jsonb,jsonb,inet,text,text) to authenticated, service_role;
