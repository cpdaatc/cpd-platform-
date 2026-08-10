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
const userIdByKey = new Map();

for (const spec of users) {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: spec.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: spec.fullName },
  });
  if (createError || !created.user) throw createError ?? new Error(`Unable to create ${spec.key}`);

  const userId = created.user.id;
  userIdByKey.set(spec.key, userId);
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

const reportActivityId = 'e2000000-0000-0000-0000-000000000101';
const methodologyId = 'e2000000-0000-0000-0000-000000000102';
const impactReportId = 'e2000000-0000-0000-0000-000000000103';
const adminUserId = userIdByKey.get('multi');
const officerUserId = userIdByKey.get('officer');
const managementUserId = userIdByKey.get('management');

const { error: activityError } = await admin.from('activities').insert({
  id: reportActivityId,
  organization_id: organizationId,
  activity_code: 'E2E-IMPACT-001',
  title_ar: 'نشاط اصطناعي لاختبار تقرير الأثر',
  title_en: 'Synthetic Impact Report Activity',
  activity_type: 'COURSE',
  planned_start_date: '2026-06-01',
  planned_end_date: '2026-06-01',
  reporting_year: 2026,
  internal_state: 'FINAL_IMPACT_REPORT',
  created_by: adminUserId,
});
if (activityError) throw activityError;

const { error: methodologyError } = await admin.from('impact_methodology_versions').insert({
  id: methodologyId,
  organization_id: organizationId,
  name: 'HTVI',
  version_label: 'E2E-1',
  status: 'ACTIVE',
  weights: { L1: 15, L2: 20, L3: 25, L4: 40 },
  rating_thresholds: { excellent: 85, very_good: 75, good: 65 },
  configured_by: adminUserId,
  approved_by: managementUserId,
  approved_at: new Date().toISOString(),
});
if (methodologyError) throw methodologyError;

const snapshot = {
  level_scores: { L1: 88.667, L2: 100, L3: 100, L4: 95.907 },
  impact_domains: { PATIENT_IMPACT: 95.9, PRACTITIONER_IMPACT: 98.9, QUALITY_SAFETY: 97.8, SERVICE_EFFICIENCY: 91.5 },
  objectives: [
    { objective_text: 'تحسين التطبيق السريري', impact_domain: 'PRACTITIONER_IMPACT', achievement: 98.9 },
    { objective_text: 'تحسين سلامة المرضى', impact_domain: 'PATIENT_IMPACT', achievement: 95.9 },
    { objective_text: 'رفع جودة الخدمة', impact_domain: 'QUALITY_SAFETY', achievement: 97.8 },
  ],
};
const { error: reportError } = await admin.from('impact_reports').insert({
  id: impactReportId,
  organization_id: organizationId,
  activity_id: reportActivityId,
  kind: 'FINAL',
  version_no: 1,
  status: 'FINAL',
  methodology_version_id: methodologyId,
  htvi_status: 'FINAL',
  htvi_score: 96.663,
  overall_rating: 'EXCELLENT',
  snapshot_json: snapshot,
  snapshot_sha256: 'a'.repeat(64),
  generated_by: officerUserId,
  finalized_at: new Date().toISOString(),
});
if (reportError) throw reportError;

console.log(JSON.stringify({
  organizationId,
  password,
  reportActivityId,
  impactReportId,
  users: users.map(({ key, email, fullName, roles }) => ({ key, email, fullName, roles })),
}));
