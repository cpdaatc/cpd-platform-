import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.E2E_DB_URL;
if (!url || !serviceRoleKey || !dbUrl) {
  throw new Error('Local Supabase API, service-role key, and database URL are required for E2E seeding.');
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const organizationId = 'e2000000-0000-0000-0000-000000000001';
const password = 'E2E-Only-Strong-Password-2026!';
const users = [
  { key: 'multi', membershipId: 'e2100000-0000-0000-0000-000000000001', email: 'e2e.admin.secretary@example.test', fullName: 'E2E Admin Secretary', roles: ['ORGANIZATION_SYSTEM_ADMIN', 'COMMITTEE_SECRETARY'] },
  { key: 'officer', membershipId: 'e2100000-0000-0000-0000-000000000002', email: 'e2e.officer@example.test', fullName: 'E2E Activity Officer', roles: ['ACTIVITY_OFFICER'] },
  { key: 'chair', membershipId: 'e2100000-0000-0000-0000-000000000003', email: 'e2e.chair@example.test', fullName: 'E2E Committee Chair', roles: ['COMMITTEE_CHAIR'] },
  { key: 'member', membershipId: 'e2100000-0000-0000-0000-000000000004', email: 'e2e.member@example.test', fullName: 'E2E Committee Member', roles: ['COMMITTEE_MEMBER'] },
  { key: 'management', membershipId: 'e2100000-0000-0000-0000-000000000005', email: 'e2e.management@example.test', fullName: 'E2E Management Approver', roles: ['MANAGEMENT_APPROVER'] },
];

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
function sqlUuid(value) {
  if (!uuidPattern.test(value)) throw new Error(`Invalid UUID returned while seeding: ${value}`);
  return `${sqlLiteral(value)}::uuid`;
}

const userIdByKey = new Map();
for (const spec of users) {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: spec.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: spec.fullName },
  });
  if (createError || !created.user) throw createError ?? new Error(`Unable to create ${spec.key}`);
  userIdByKey.set(spec.key, created.user.id);
}

const adminUserId = userIdByKey.get('multi');
const officerUserId = userIdByKey.get('officer');
const managementUserId = userIdByKey.get('management');
if (!adminUserId || !officerUserId || !managementUserId) throw new Error('Synthetic role users were not created.');

const reportActivityId = 'e2000000-0000-0000-0000-000000000101';
const methodologyId = 'e2000000-0000-0000-0000-000000000102';
const impactReportId = 'e2000000-0000-0000-0000-000000000103';
const snapshot = {
  level_scores: { L1: 88.667, L2: 100, L3: 100, L4: 95.907 },
  impact_domains: { PATIENT_IMPACT: 95.9, PRACTITIONER_IMPACT: 98.9, QUALITY_SAFETY: 97.8, SERVICE_EFFICIENCY: 91.5 },
  objectives: [
    { objective_text: 'تحسين التطبيق السريري', impact_domain: 'PRACTITIONER_IMPACT', achievement: 98.9 },
    { objective_text: 'تحسين سلامة المرضى', impact_domain: 'PATIENT_IMPACT', achievement: 95.9 },
    { objective_text: 'رفع جودة الخدمة', impact_domain: 'QUALITY_SAFETY', achievement: 97.8 },
  ],
};

const statements = [
  '\\set ON_ERROR_STOP on',
  'begin;',
  `insert into public.organizations(id,name,slug,status) values (${sqlUuid(organizationId)},${sqlLiteral('E2E Synthetic Healthcare Organization')},${sqlLiteral('e2e-synthetic-healthcare')},'ACTIVE') on conflict(id) do update set name=excluded.name,status='ACTIVE';`,
];

for (const spec of users) {
  const userId = userIdByKey.get(spec.key);
  if (!userId) throw new Error(`Missing Auth UUID for ${spec.key}`);
  statements.push(
    `update public.users set display_name=${sqlLiteral(spec.fullName)} where id=${sqlUuid(userId)};`,
    `insert into public.organization_memberships(id,organization_id,user_id,status) values (${sqlUuid(spec.membershipId)},${sqlUuid(organizationId)},${sqlUuid(userId)},'ACTIVE') on conflict(organization_id,user_id) do update set status='ACTIVE';`,
  );
  for (const role of spec.roles) {
    statements.push(`insert into public.user_roles(organization_id,membership_id,role_id,assigned_by) select ${sqlUuid(organizationId)},${sqlUuid(spec.membershipId)},r.id,${sqlUuid(adminUserId)} from public.roles r where r.code=${sqlLiteral(role)} on conflict(membership_id,role_id) do nothing;`);
  }
}

statements.push(
  `insert into public.activities(id,organization_id,activity_code,title_ar,title_en,activity_type,planned_start_date,planned_end_date,reporting_year,internal_state,created_by) values (${sqlUuid(reportActivityId)},${sqlUuid(organizationId)},'E2E-IMPACT-001',${sqlLiteral('نشاط اصطناعي لاختبار تقرير الأثر')},'Synthetic Impact Report Activity','COURSE','2026-06-01','2026-06-01',2026,'FINAL_IMPACT_REPORT',${sqlUuid(adminUserId)});`,
  `insert into public.impact_methodology_versions(id,organization_id,name,version_label,status,weights,rating_thresholds,configured_by,approved_by,approved_at) values (${sqlUuid(methodologyId)},${sqlUuid(organizationId)},'HTVI','E2E-1','ACTIVE','{"L1":15,"L2":20,"L3":25,"L4":40}'::jsonb,'{"excellent":85,"very_good":75,"good":65}'::jsonb,${sqlUuid(adminUserId)},${sqlUuid(managementUserId)},now());`,
  `insert into public.impact_reports(id,organization_id,activity_id,kind,version_no,status,methodology_version_id,htvi_status,htvi_score,overall_rating,snapshot_json,snapshot_sha256,generated_by,finalized_at) values (${sqlUuid(impactReportId)},${sqlUuid(organizationId)},${sqlUuid(reportActivityId)},'FINAL',1,'FINAL',${sqlUuid(methodologyId)},'FINAL',96.663,'EXCELLENT',${sqlLiteral(JSON.stringify(snapshot))}::jsonb,${sqlLiteral('a'.repeat(64))},${sqlUuid(officerUserId)},now());`,
  'commit;',
);

execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1'], {
  input: `${statements.join('\n')}\n`,
  stdio: ['pipe', 'inherit', 'inherit'],
});

console.log(`Seeded ${users.length} synthetic Auth users and governed public UAT fixtures.`);
