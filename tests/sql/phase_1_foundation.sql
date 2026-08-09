\set ON_ERROR_STOP on

create or replace function public._assert(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if not condition then
    raise exception 'ASSERTION FAILED: %', message;
  end if;
end;
$$;

select public._assert(to_regclass('public.organizations') is not null, 'organizations table exists');
select public._assert(to_regclass('public.organization_memberships') is not null, 'organization_memberships table exists');
select public._assert(to_regclass('public.roles') is not null, 'roles table exists');
select public._assert(to_regclass('public.permissions') is not null, 'permissions table exists');
select public._assert(to_regclass('public.activities') is not null, 'activities table exists');
select public._assert(to_regclass('public.activity_assignments') is not null, 'activity_assignments table exists');
select public._assert(to_regclass('public.activity_status_history') is not null, 'activity_status_history table exists');

select public._assert(
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='activities' and column_name='organization_id'
  ),
  'activities carries organization_id'
);

select public._assert(
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='activities' and column_name='internal_state'
  ),
  'activities stores internal workflow state'
);

select public._assert(
  not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='activities' and column_name in ('committee_decision','scfhs_status','impact_status')
  ),
  'activities does not overload committee/external/impact statuses'
);
