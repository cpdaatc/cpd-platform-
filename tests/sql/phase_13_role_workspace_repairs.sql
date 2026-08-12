\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
select public._assert(
  (select count(*) from public.list_organization_users_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN')) >= 5,
  'organization user listing returns its declared text email contract for an authorized admin'
);
reset role;
