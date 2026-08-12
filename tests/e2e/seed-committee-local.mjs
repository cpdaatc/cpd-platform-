import { execFileSync } from 'node:child_process';

const dbUrl = process.env.E2E_DB_URL;
if (!dbUrl) throw new Error('E2E_DB_URL is required for committee fixture seeding.');

const sql = String.raw`
\set ON_ERROR_STOP on
begin;

insert into public.institutional_committees(
  id, organization_id, committee_name, appointment_reference, appointment_date,
  appointed_by, effective_from, effective_to, status, created_by
)
select
  'e2000000-0000-0000-0000-000000000201'::uuid,
  'e2000000-0000-0000-0000-000000000001'::uuid,
  'E2E Institutional Scientific Committee',
  'E2E-APPOINTMENT-2026',
  '2026-01-01',
  'Synthetic Management Decision',
  '2026-01-01',
  null,
  'ACTIVE',
  u.id
from public.users u
where u.display_name='E2E Admin Secretary'
on conflict(id) do nothing;

insert into public.institutional_committee_members(
  id, organization_id, committee_id, user_id, full_name_snapshot,
  committee_role, appointment_from, status
)
select
  'e2000000-0000-0000-0000-000000000202'::uuid,
  'e2000000-0000-0000-0000-000000000001'::uuid,
  'e2000000-0000-0000-0000-000000000201'::uuid,
  u.id,
  'E2E Committee Chair',
  'CHAIR',
  '2026-01-01',
  'ACTIVE'
from public.users u where u.display_name='E2E Committee Chair'
on conflict(id) do nothing;

insert into public.institutional_committee_members(
  id, organization_id, committee_id, user_id, full_name_snapshot,
  committee_role, appointment_from, status
)
select
  'e2000000-0000-0000-0000-000000000203'::uuid,
  'e2000000-0000-0000-0000-000000000001'::uuid,
  'e2000000-0000-0000-0000-000000000201'::uuid,
  u.id,
  'E2E Admin Secretary',
  'SECRETARY',
  '2026-01-01',
  'ACTIVE'
from public.users u where u.display_name='E2E Admin Secretary'
on conflict(id) do nothing;

insert into public.institutional_committee_members(
  id, organization_id, committee_id, user_id, full_name_snapshot,
  committee_role, appointment_from, status
)
select
  'e2000000-0000-0000-0000-000000000204'::uuid,
  'e2000000-0000-0000-0000-000000000001'::uuid,
  'e2000000-0000-0000-0000-000000000201'::uuid,
  u.id,
  'E2E Committee Member',
  'MEMBER',
  '2026-01-01',
  'ACTIVE'
from public.users u where u.display_name='E2E Committee Member'
on conflict(id) do nothing;

commit;
`;

execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1'], {
  input: sql,
  stdio: ['pipe', 'inherit', 'inherit'],
});

console.log('Seeded active synthetic institutional committee fixture.');
