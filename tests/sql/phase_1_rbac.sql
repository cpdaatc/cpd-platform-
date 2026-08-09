\set ON_ERROR_STOP on

select public._assert((select count(*) from public.roles)=9, 'nine canonical roles are seeded');

select public._assert(
  (select count(*)
   from public.roles r
   join public.role_permissions rp on rp.role_id=r.id
   join public.permissions p on p.id=rp.permission_id
   where p.code='activity.final_decision') = 1,
  'activity.final_decision has exactly one role'
);

select public._assert(
  exists (
    select 1 from public.roles r
    join public.role_permissions rp on rp.role_id=r.id
    join public.permissions p on p.id=rp.permission_id
    where p.code='activity.final_decision' and r.code='COMMITTEE_CHAIR'
  ),
  'committee chair owns final decision permission'
);

select public._assert(
  not exists (
    select 1 from public.roles r
    join public.role_permissions rp on rp.role_id=r.id
    join public.permissions p on p.id=rp.permission_id
    where p.code='activity.create' and r.code='ACTIVITY_OFFICER'
  ),
  'activity officer cannot create activities'
);

select public._assert(
  exists (
    select 1 from public.roles r
    join public.role_permissions rp on rp.role_id=r.id
    join public.permissions p on p.id=rp.permission_id
    where r.code='MANAGEMENT_APPROVER' and p.code='methodology.approve'
  ),
  'management approver owns methodology approval'
);

select public._assert(
  exists (
    select 1 from public.roles r
    join public.role_permissions rp on rp.role_id=r.id
    join public.permissions p on p.id=rp.permission_id
    where r.code='MANAGEMENT_APPROVER' and p.code='annual.acknowledge'
  ),
  'management approver owns annual acknowledgement'
);
