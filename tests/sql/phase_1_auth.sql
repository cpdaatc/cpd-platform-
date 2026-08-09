\set ON_ERROR_STOP on

insert into auth.users(id,email) values
  ('00000000-0000-0000-0000-000000000301','profile-bootstrap@example.test');

select public._assert(
  exists (
    select 1 from public.users
    where id='00000000-0000-0000-0000-000000000301'
  ),
  'auth.users insert automatically bootstraps public.users profile'
);
