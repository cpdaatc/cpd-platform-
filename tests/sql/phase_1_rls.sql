\set ON_ERROR_STOP on

-- Synthetic identities and tenants for direct-API/RLS simulation.
insert into auth.users(id,email) values
  ('00000000-0000-0000-0000-000000000101','admin-a@example.test'),
  ('00000000-0000-0000-0000-000000000102','officer-a@example.test'),
  ('00000000-0000-0000-0000-000000000201','admin-b@example.test')
on conflict (id) do nothing;

insert into public.users(id,display_name) values
  ('00000000-0000-0000-0000-000000000101','Admin A'),
  ('00000000-0000-0000-0000-000000000102','Officer A'),
  ('00000000-0000-0000-0000-000000000201','Admin B')
on conflict (id) do nothing;

insert into public.organizations(id,name,slug) values
  ('10000000-0000-0000-0000-000000000001','Demo Organization A','demo-a'),
  ('20000000-0000-0000-0000-000000000001','Demo Organization B','demo-b')
on conflict (id) do nothing;

insert into public.organization_memberships(id,organization_id,user_id) values
  ('11000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101'),
  ('11000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102'),
  ('22000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000201')
on conflict (id) do nothing;

insert into public.user_roles(organization_id,membership_id,role_id)
select '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', id
from public.roles where code='ORGANIZATION_SYSTEM_ADMIN'
on conflict do nothing;

insert into public.user_roles(organization_id,membership_id,role_id)
select '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', id
from public.roles where code='ACTIVITY_OFFICER'
on conflict do nothing;

insert into public.user_roles(organization_id,membership_id,role_id)
select '20000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', id
from public.roles where code='ORGANIZATION_SYSTEM_ADMIN'
on conflict do nothing;

insert into public.activities(
  id,organization_id,activity_code,title_ar,reporting_year,created_by
) values
  ('a1000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','CPD-2026-001','نشاط أ 1',2026,'00000000-0000-0000-0000-000000000101'),
  ('a1000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','CPD-2026-002','نشاط أ 2',2026,'00000000-0000-0000-0000-000000000101'),
  ('b2000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','CPD-2026-001','نشاط ب 1',2026,'00000000-0000-0000-0000-000000000201')
on conflict (id) do nothing;

insert into public.activity_assignments(
  id,organization_id,activity_id,membership_id,assigned_by
) values (
  'aa000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000101'
)
on conflict (id) do nothing;

-- Admin A: organization isolation plus organization-wide activity visibility.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101', false);

select public._assert((select count(*) from public.organizations)=1, 'Admin A sees only Organization A');
select public._assert((select count(*) from public.activities)=2, 'Admin A sees all activities in Organization A only');
select public._assert(
  (select count(*) from public.activities where organization_id='20000000-0000-0000-0000-000000000001')=0,
  'Admin A cannot read Organization B activities'
);

insert into public.activities(
  organization_id,activity_code,title_ar,reporting_year,created_by
) values (
  '10000000-0000-0000-0000-000000000001','CPD-2026-003','نشاط أ 3',2026,
  '00000000-0000-0000-0000-000000000101'
);

select public._assert(
  exists (select 1 from public.activities where activity_code='CPD-2026-003'),
  'Admin A can create an activity in own organization'
);

do $$
begin
  begin
    insert into public.activities(
      organization_id,activity_code,title_ar,reporting_year,created_by
    ) values (
      '20000000-0000-0000-0000-000000000001','CPD-2026-X','Cross tenant write',2026,
      '00000000-0000-0000-0000-000000000101'
    );
    raise exception 'cross-tenant insert unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm = 'cross-tenant insert unexpectedly succeeded' then raise; end if;
      if sqlstate <> '42501' then raise; end if;
  end;
end $$;

-- Security-definer RPCs must not become a tenant-isolation bypass.
do $$
begin
  begin
    perform public.log_audit_event(
      '20000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000101',
      'ORGANIZATION_SYSTEM_ADMIN',
      'security.cross_tenant_probe',
      'organization',
      '20000000-0000-0000-0000-000000000001',
      null,
      null,
      null,
      'rls-test',
      'req-cross-tenant'
    );
    raise exception 'cross-tenant audit RPC unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm = 'cross-tenant audit RPC unexpectedly succeeded' then raise; end if;
      if sqlstate <> '42501' then raise; end if;
  end;
end $$;

reset role;

-- Officer A: assignment-scoped visibility and no activity creation.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102', false);

select public._assert((select count(*) from public.organizations)=1, 'Officer A sees own organization');
select public._assert((select count(*) from public.activities)=1, 'Officer A sees only assigned activity');
select public._assert(
  exists (select 1 from public.activities where id='a1000000-0000-0000-0000-000000000001'),
  'Officer A sees assigned Activity A1'
);

do $$
begin
  begin
    insert into public.activities(
      organization_id,activity_code,title_ar,reporting_year,created_by
    ) values (
      '10000000-0000-0000-0000-000000000001','CPD-2026-OFFICER','Officer should not create',2026,
      '00000000-0000-0000-0000-000000000102'
    );
    raise exception 'officer insert unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm = 'officer insert unexpectedly succeeded' then raise; end if;
      if sqlstate <> '42501' then raise; end if;
  end;
end $$;

reset role;
