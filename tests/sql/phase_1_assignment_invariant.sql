\set ON_ERROR_STOP on

insert into auth.users(id,email) values
  ('00000000-0000-0000-0000-000000000601','admin-e@example.test'),
  ('00000000-0000-0000-0000-000000000602','officer-e1@example.test'),
  ('00000000-0000-0000-0000-000000000603','officer-e2@example.test')
on conflict (id) do nothing;

update public.users set display_name='Admin E' where id='00000000-0000-0000-0000-000000000601';
update public.users set display_name='Officer E1' where id='00000000-0000-0000-0000-000000000602';
update public.users set display_name='Officer E2' where id='00000000-0000-0000-0000-000000000603';

insert into public.organizations(id,name,slug) values
  ('60000000-0000-0000-0000-000000000001','Demo Organization E','demo-e')
on conflict (id) do nothing;

insert into public.organization_memberships(id,organization_id,user_id) values
  ('66000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000601'),
  ('66000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000602'),
  ('66000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000603')
on conflict (id) do nothing;

insert into public.user_roles(organization_id,membership_id,role_id)
select '60000000-0000-0000-0000-000000000001','66000000-0000-0000-0000-000000000001',id
from public.roles where code='ORGANIZATION_SYSTEM_ADMIN'
on conflict do nothing;

insert into public.user_roles(organization_id,membership_id,role_id)
select '60000000-0000-0000-0000-000000000001',v.membership_id,r.id
from public.roles r
cross join (values
  ('66000000-0000-0000-0000-000000000002'::uuid),
  ('66000000-0000-0000-0000-000000000003'::uuid)
) as v(membership_id)
where r.code='ACTIVITY_OFFICER'
on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000601', false);

create temporary table assignment_activity as
select * from public.create_activity_command(
  '60000000-0000-0000-0000-000000000001',
  'ORGANIZATION_SYSTEM_ADMIN',
  'نشاط اختبار الإسناد',
  null,null,null,null,null,null,2026
);

select public.assign_activity_officer_command(
  '60000000-0000-0000-0000-000000000001',
  'ORGANIZATION_SYSTEM_ADMIN',
  (select id from assignment_activity),
  '66000000-0000-0000-0000-000000000002'
);

select public.assign_activity_officer_command(
  '60000000-0000-0000-0000-000000000001',
  'ORGANIZATION_SYSTEM_ADMIN',
  (select id from assignment_activity),
  '66000000-0000-0000-0000-000000000003'
);

select public._assert(
  (select count(*) from public.activity_assignments
   where activity_id=(select id from assignment_activity)
     and assignment_role='ACTIVITY_OFFICER'
     and is_active=true) = 1,
  'an activity has exactly one active Activity Officer after reassignment'
);

select public._assert(
  exists (
    select 1 from public.activity_assignments
    where activity_id=(select id from assignment_activity)
      and membership_id='66000000-0000-0000-0000-000000000003'
      and is_active=true
  ),
  'the newly assigned Activity Officer is active'
);

select public._assert(
  exists (
    select 1 from public.activity_assignments
    where activity_id=(select id from assignment_activity)
      and membership_id='66000000-0000-0000-0000-000000000002'
      and is_active=false
  ),
  'the previous assignment remains in history but is inactive'
);

reset role;
