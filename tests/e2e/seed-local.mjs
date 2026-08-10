import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error('Local Supabase URL and service role key are required for E2E seeding.');

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const organizationId = 'e2000000-0000-0000-0000-000000000001';
const password = 'E2E-Only-Strong-Password-2026!';
const users = [
  { key: 'multi', email: 'e2e.admin.secretary@example.test', fullName: 'E2E Admin Secretary', roles: ['ORGANIZATION_SYSTEM_ADMIN', 'COMMITTEE_SECRETARY'] },
  { key: 'officer', email: 'e2e.officer@example.test', fullName: 'E2E Activity Officer', roles: ['ACTIVITY_OFFICER'] },
  { key: 'chair', email: 'e2e.chair@example.test', fullName: 'E2E Committee Chair', roles: ['COMMITTEE_CHAIR'] },
  { key: 'member', email: 'e2e.member@example.test', fullName: 'E2E Committee Member', roles: ['COMMITTEE_MEMBER'] },
  { key: 'management', email: 'e2e.management@example.test', fullName: 'E2E Management Approver', roles: ['MANAGEMENT_APPROVER'] },
];

const { error: orgError } = await admin.from('organizations').upsert({
  id: organizationId,
  name: 'E2E Synthetic Healthcare Organization',
  slug: 'e2e-synthetic-healthcare',
  status: 'ACTIVE',
}, { onConflict: 'id' });
if (orgError) throw orgError;

const { data: roleRows, error: rolesError } = await admin.from('roles').select('id,code').in('code', [...new Set(users.flatMap((user) => user.roles))]);
if (rolesError) throw rolesError;
const roleIdByCode = new Map((roleRows ?? []).map((row) => [row.code, row.id]));

for (const spec of users) {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: spec.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: spec.fullName },
  });
  if (createError || !created.user) throw createError ?? new Error(`Unable to create ${spec.key}`);

  const userId = created.user.id;
  const { error: profileError } = await admin.from('users').update({ display_name: spec.fullName }).eq('id', userId);
  if (profileError) throw profileError;

  const { data: membership, error: membershipError } = await admin.from('organization_memberships').insert({
    organization_id: organizationId,
    user_id: userId,
    status: 'ACTIVE',
  }).select('id').single();
  if (membershipError || !membership) throw membershipError ?? new Error(`Unable to create membership for ${spec.key}`);

  const grants = spec.roles.map((code) => {
    const roleId = roleIdByCode.get(code);
    if (!roleId) throw new Error(`Seed role is missing: ${code}`);
    return { organization_id: organizationId, membership_id: membership.id, role_id: roleId, assigned_by: userId };
  });
  const { error: grantError } = await admin.from('user_roles').insert(grants);
  if (grantError) throw grantError;
}

console.log(JSON.stringify({ organizationId, password, users: users.map(({ key, email, fullName, roles }) => ({ key, email, fullName, roles })) }));
