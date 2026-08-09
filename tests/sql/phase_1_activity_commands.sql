\set ON_ERROR_STOP on

-- Independent organization for governed command tests.
insert into auth.users(id,email) values
  ('00000000-0000-0000-0000-000000000401','admin-c@example.test'),
  ('00000000-0000-0000-0000-000000000402','officer-c@example.test')
on conflict (id) do nothing;

insert into public.users(id,display_name) values
  ('00000000-0000-0000-0000-000000000401','Admin C'),
  ('00000000-0000-0000-0000-000000000402','Officer C')
on conflict (id) do nothing;

insert into public.organizations(id,name,slug) values
  ('30000000-0000-0000-0000-000000000001','Demo Organization C','demo-c')
on conflict (id) do nothing;

insert into public.organization_memberships(id,organization_id,user_id) values
  ('33000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000401'),
  ('33000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000402')
on conflict (id) do nothing;

insert into public.user_roles(organization_id,membership_id,role_id)
select '30000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', id
from public.roles where code='ORGANIZATION_SYSTEM_ADMIN'
on conflict do nothing;

insert into public.user_roles(organization_id,membership_id,role_id)
select '30000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000002', id
from public.roles where code='ACTIVITY_OFFICER'
on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000401', false);

create temporary table command_result as
select * from public.create_activity_command(
  '30000000-0000-0000-0000-000000000001',
  'ORGANIZATION_SYSTEM_ADMIN',
  'نشاط محكوم 1',
  'Governed Activity 1',
  'COURSE',
  null,
  '2026-09-01',
  '2026-09-01',
  'IN_PERSON',
  2026
);

select public._assert(
  (select activity_code from command_result)='CPD-2026-001',
  'first governed activity code is generated atomically'
);

select public._assert(
  exists (
    select 1 from public.audit_logs
    where organization_id='30000000-0000-0000-0000-000000000001'
      and action='activity.created'
      and role_context='ORGANIZATION_SYSTEM_ADMIN'
  ),
  'activity creation writes audit event in same governed command'
);

select public.create_activity_command(
  '30000000-0000-0000-0000-000000000001',
  'ORGANIZATION_SYSTEM_ADMIN',
  'نشاط محكوم 2',
  null,
  null,
  null,
  null,
  null,
  null,
  2026
);

select public._assert(
  exists (
    select 1 from public.activities
    where organization_id='30000000-0000-0000-0000-000000000001'
      and activity_code='CPD-2026-002'
  ),
  'sequence increments per organization and reporting year'
);

-- The same user cannot claim a different role context that was not assigned.
do $$
begin
  begin
    perform public.create_activity_command(
      '30000000-0000-0000-0000-000000000001',
      'COMMITTEE_SECRETARY',
      'غير مسموح', null, null, null, null, null, null, 2026
    );
    raise exception 'unassigned role context unexpectedly created activity';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm = 'unassigned role context unexpectedly created activity' then raise; end if;
      if sqlstate <> '42501' then raise; end if;
  end;
end $$;

select public.assign_activity_officer_command(
  '30000000-0000-0000-0000-000000000001',
  'ORGANIZATION_SYSTEM_ADMIN',
  (select id from command_result),
  '33000000-0000-0000-0000-000000000002'
);

select public._assert(
  exists (
    select 1 from public.activity_assignments
    where activity_id=(select id from command_result)
      and membership_id='33000000-0000-0000-0000-000000000002'
      and is_active=true
  ),
  'governed assignment links the activity officer'
);

select public._assert(
  exists (
    select 1 from public.audit_logs
    where organization_id='30000000-0000-0000-0000-000000000001'
      and action='activity.officer_assigned'
      and entity_id=(select id from command_result)
  ),
  'assignment writes an audit event'
);

reset role;
