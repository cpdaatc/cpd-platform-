import { execFileSync } from 'node:child_process';

const dbUrl = process.env.E2E_DB_URL;
if (!dbUrl) throw new Error('E2E_DB_URL is required for print fixture seeding.');

const sql = String.raw`
\set ON_ERROR_STOP on
begin;

do $$
declare
  v_org uuid := 'e2000000-0000-0000-0000-000000000001';
  v_activity uuid := 'e2000000-0000-0000-0000-000000000101';
  v_committee uuid := 'e2000000-0000-0000-0000-000000000201';
  v_chair_member uuid := 'e2000000-0000-0000-0000-000000000202';
  v_secretary_member uuid := 'e2000000-0000-0000-0000-000000000203';
  v_member uuid := 'e2000000-0000-0000-0000-000000000204';
  v_minutes uuid := 'e2000000-0000-0000-0000-000000000301';
  v_revision uuid := 'e2000000-0000-0000-0000-000000000302';
  v_meeting uuid := 'e2000000-0000-0000-0000-000000000303';
  v_review uuid := 'e2000000-0000-0000-0000-000000000304';
  v_annual uuid := 'e2000000-0000-0000-0000-000000000401';
  v_admin uuid;
  v_chair uuid;
  v_member_user uuid;
  v_management uuid;
  v_snapshot jsonb;
begin
  select id into strict v_admin from auth.users where email='e2e.admin.secretary@example.test';
  select id into strict v_chair from auth.users where email='e2e.chair@example.test';
  select id into strict v_member_user from auth.users where email='e2e.member@example.test';
  select id into strict v_management from auth.users where email='e2e.management@example.test';

  insert into public.activity_revisions(
    id,organization_id,activity_id,revision_no,status,snapshot_json,snapshot_sha256,
    change_summary,created_by,submitted_by,submitted_at,finalized_at
  ) values (
    v_revision,v_org,v_activity,1,'FINAL_ACCEPTED',
    jsonb_build_object('activity_code','E2E-IMPACT-001','title_ar','نشاط اصطناعي لاختبار تقرير الأثر'),
    repeat('b',64),'Synthetic print fixture',v_admin,v_admin,now(),now()
  ) on conflict(id) do nothing;

  insert into public.committee_meetings(
    id,organization_id,committee_id,meeting_reference,scheduled_at,location_or_channel,status,created_by
  ) values (
    v_meeting,v_org,v_committee,'E2E-MINUTES-PRINT-001','2026-02-05 10:00+03','E2E Governance Room','CLOSED',v_admin
  ) on conflict(id) do nothing;

  insert into public.committee_reviews(
    id,organization_id,activity_id,revision_id,meeting_id,status,recorded_by,recorded_at
  ) values (
    v_review,v_org,v_activity,v_revision,v_meeting,'CLOSED',v_admin,now()
  ) on conflict(id) do nothing;

  insert into public.meeting_attendance(
    organization_id,meeting_id,committee_member_id,attendance_status,recorded_by
  ) values
    (v_org,v_meeting,v_chair_member,'PRESENT',v_admin),
    (v_org,v_meeting,v_secretary_member,'PRESENT',v_admin),
    (v_org,v_meeting,v_member,'PRESENT',v_admin)
  on conflict(meeting_id,committee_member_id) do nothing;

  insert into public.committee_standard_results(
    organization_id,review_id,criterion_code,criterion_text,source_rule_code,
    evidence_availability,assessment,notes,recorded_by
  ) values
    (v_org,v_review,'E2E-C01','Scientific relevance and documented need','ACT-GOV-001','UPLOADED','MEET','Synthetic evidence reviewed',v_admin),
    (v_org,v_review,'E2E-C02','Objectives and educational alignment','ACT-NEED-001','UPLOADED','MEET','Objectives aligned with methods',v_admin)
  on conflict(review_id,criterion_code) do nothing;

  insert into public.committee_decisions(
    organization_id,activity_id,review_id,revision_id,decision,decision_body,
    recorded_by,final_decision_by,decision_notes,decided_at
  ) values (
    v_org,v_activity,v_review,v_revision,'APPROVED_FOR_SCFHS_SUBMISSION',
    'INSTITUTIONAL_SCIENTIFIC_COMMITTEE',v_admin,v_chair,
    'Synthetic internal approval for official minutes print verification.',now()
  ) on conflict(review_id) do nothing;

  v_snapshot := jsonb_build_object(
    'activity',jsonb_build_object(
      'activity_code','E2E-IMPACT-001',
      'title_ar','نشاط اصطناعي لاختبار محضر اللجنة'
    ),
    'meeting',jsonb_build_object(
      'meeting_reference','E2E-MINUTES-PRINT-001',
      'scheduled_at','2026-02-05 10:00+03'
    ),
    'committee',jsonb_build_object(
      'committee_name','E2E Institutional Scientific Committee',
      'appointment_reference','E2E-APPOINTMENT-2026'
    ),
    'attendance',jsonb_build_array(
      jsonb_build_object('full_name','E2E Committee Chair','role','CHAIR','status','PRESENT'),
      jsonb_build_object('full_name','E2E Admin Secretary','role','SECRETARY','status','PRESENT'),
      jsonb_build_object('full_name','E2E Committee Member','role','MEMBER','status','PRESENT')
    ),
    'collective_results',jsonb_build_array(
      jsonb_build_object('criterion_code','E2E-C01','criterion_text','Scientific relevance and documented need','evidence_availability','UPLOADED','assessment','MEET','notes','Synthetic evidence reviewed'),
      jsonb_build_object('criterion_code','E2E-C02','criterion_text','Objectives and educational alignment','evidence_availability','UPLOADED','assessment','MEET','notes','Objectives aligned with methods')
    ),
    'decision',jsonb_build_object(
      'decision','APPROVED_FOR_SCFHS_SUBMISSION',
      'decision_notes','Synthetic internal approval for official minutes print verification.'
    )
  );

  insert into public.committee_minutes(
    id,organization_id,activity_id,review_id,meeting_id,version_no,status,
    snapshot_json,snapshot_sha256,prepared_by,finalized_by,finalized_at
  ) values (
    v_minutes,v_org,v_activity,v_review,v_meeting,1,'FINAL',v_snapshot,repeat('c',64),v_admin,v_chair,now()
  ) on conflict(id) do nothing;

  insert into public.annual_committee_reports(
    id,organization_id,reporting_year,status,snapshot_json,snapshot_sha256,
    generated_by,generated_at,chair_approved_by,chair_approved_at,submitted_to_management_at
  ) values (
    v_annual,v_org,2025,'ACKNOWLEDGED',
    jsonb_build_object('reporting_year',2025,'fixture','official-print-qa'),repeat('d',64),
    v_admin,now(),v_chair,now(),now()
  ) on conflict(id) do nothing;

  insert into public.annual_report_metrics(
    organization_id,annual_report_id,metric_code,metric_value,denominator
  ) values
    (v_org,v_annual,'ACTIVITIES_TOTAL',12,null),
    (v_org,v_annual,'COMMITTEE_APPROVED',9,null),
    (v_org,v_annual,'COMMITTEE_RETURNED',2,null),
    (v_org,v_annual,'COMMITTEE_NOT_APPROVED',1,null),
    (v_org,v_annual,'FINAL_IMPACT_REPORTS',8,10),
    (v_org,v_annual,'FINAL_HTVI_AVERAGE',91.4,10),
    (v_org,v_annual,'HTVI_COVERAGE_PERCENT',80,10)
  on conflict(annual_report_id,metric_code) do nothing;

  insert into public.member_contribution_metrics(
    organization_id,annual_report_id,committee_member_id,full_name_snapshot,committee_role,
    appointment_from,eligible_meetings,attended_meetings,absent_meetings,excused_meetings,
    attendance_rate,activities_reviewed,contribution_statement
  ) values
    (v_org,v_annual,v_chair_member,'E2E Committee Chair','CHAIR','2025-01-01',6,6,0,0,100,9,'Synthetic verified Chair participation.'),
    (v_org,v_annual,v_secretary_member,'E2E Admin Secretary','SECRETARY','2025-01-01',6,6,0,0,100,9,'Synthetic verified Secretary participation.'),
    (v_org,v_annual,v_member,'E2E Committee Member','MEMBER','2025-01-01',6,5,1,0,83.333,8,'Synthetic verified member participation.')
  on conflict(annual_report_id,committee_member_id) do nothing;

  insert into public.annual_report_acknowledgements(
    organization_id,annual_report_id,acknowledged_by,management_comment,acknowledged_at
  ) values (
    v_org,v_annual,v_management,'Synthetic management acknowledgement for print QA.',now()
  ) on conflict(annual_report_id) do nothing;
end $$;

commit;
`;

execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1'], {
  input: sql,
  stdio: ['pipe', 'inherit', 'inherit'],
});

console.log('Seeded immutable committee-minutes and annual-report print fixtures.');
