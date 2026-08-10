\set ON_ERROR_STOP on

-- Phase 4: permanent institutional scientific committee, immutable revisions,
-- collective review, Chair-only decision, immutable minutes and controlled correction.

insert into auth.users(id,email) values
  ('00000000-0000-0000-0000-000000000901','p4-admin@example.test'),
  ('00000000-0000-0000-0000-000000000902','p4-officer@example.test'),
  ('00000000-0000-0000-0000-000000000903','p4-secretary@example.test'),
  ('00000000-0000-0000-0000-000000000904','p4-chair@example.test'),
  ('00000000-0000-0000-0000-000000000905','p4-member@example.test')
on conflict(id) do nothing;

insert into public.organizations(id,name,slug) values
  ('90000000-0000-0000-0000-000000000010','Phase 4 Org','phase-4-org')
on conflict(id) do nothing;

insert into public.organization_memberships(id,organization_id,user_id,status) values
  ('90000000-0000-0000-0000-000000000101','90000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000901','ACTIVE'),
  ('90000000-0000-0000-0000-000000000102','90000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000902','ACTIVE'),
  ('90000000-0000-0000-0000-000000000103','90000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000903','ACTIVE'),
  ('90000000-0000-0000-0000-000000000104','90000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000904','ACTIVE'),
  ('90000000-0000-0000-0000-000000000105','90000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000905','ACTIVE')
on conflict(id) do nothing;

insert into public.user_roles(organization_id,membership_id,role_id) values
  ('90000000-0000-0000-0000-000000000010','90000000-0000-0000-0000-000000000101',(select id from public.roles where code='ORGANIZATION_SYSTEM_ADMIN')),
  ('90000000-0000-0000-0000-000000000010','90000000-0000-0000-0000-000000000102',(select id from public.roles where code='ACTIVITY_OFFICER')),
  ('90000000-0000-0000-0000-000000000010','90000000-0000-0000-0000-000000000103',(select id from public.roles where code='COMMITTEE_SECRETARY')),
  ('90000000-0000-0000-0000-000000000010','90000000-0000-0000-0000-000000000104',(select id from public.roles where code='COMMITTEE_CHAIR')),
  ('90000000-0000-0000-0000-000000000010','90000000-0000-0000-0000-000000000105',(select id from public.roles where code='COMMITTEE_MEMBER'))
on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);

create temporary table p4_activity as
select (public.create_activity_command(
  '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN','نشاط اللجنة',null,
  'COURSE','GROUP_INTERACTIVE','2026-12-01','2026-12-01',2026
)).id as id;

select public.assign_activity_officer_command(
  '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',(select id from p4_activity),
  '00000000-0000-0000-0000-000000000902','P4 assignment'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000902',false);
select public.save_activity_intake_command(
  '90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p4_activity),
  jsonb_build_object(
    'profile',jsonb_build_object(
      'intakeRoute','DIGITAL','specialty','Medical Education','activityLanguages',jsonb_build_array('EN'),
      'targetAudience','Healthcare professionals','selectAllMedicalFields',false,
      'learningGap','Measured governance gap','aimAndOutcomes','Improve governed practice',
      'learningMethods','Interactive case discussion','participantEvaluationMethod','Post-test',
      'activityScope','LOCAL','formStatus','CONFIRMED'
    ),
    'needsAssessmentTools',jsonb_build_array(jsonb_build_object('toolCode','SURVEY')),
    'objectives',jsonb_build_array(jsonb_build_object('objectiveText','Apply governed workflow','learningDomain','SKILL','sortOrder',1)),
    'committeeMembers',jsonb_build_array(
      jsonb_build_object('fullName','Activity Member 1','classificationNumber','A1','sortOrder',1),
      jsonb_build_object('fullName','Activity Member 2','classificationNumber','A2','sortOrder',2)
    ),
    'speakers','[]'::jsonb,'sessions','[]'::jsonb,'disclosures','[]'::jsonb
  )
);
select public.save_pre_review_command(
  '90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p4_activity),
  'PRE_REVIEW','COMPLETED','[]'::jsonb
);
create temporary table p4_rev1 as
select public.submit_activity_revision_command(
  '90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p4_activity),'Initial submission'
) as id;

select public._assert((select status from public.activity_revisions where id=(select id from p4_rev1))='SUBMITTED','submitted revision is immutable snapshot');
select public._assert((select internal_state from public.activities where id=(select id from p4_activity))='READY_FOR_COMMITTEE','submission advances to committee readiness');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
create temporary table p4_committee as
select public.create_institutional_committee_command(
  '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN','Institutional Scientific Committee',
  'MGMT-P4-001','2026-01-01','Hospital Management','2026-01-01','2026-12-31',
  jsonb_build_array(
    jsonb_build_object('userId','00000000-0000-0000-0000-000000000904','fullName','P4 Chair','committeeRole','CHAIR'),
    jsonb_build_object('userId','00000000-0000-0000-0000-000000000903','fullName','P4 Secretary','committeeRole','SECRETARY'),
    jsonb_build_object('userId','00000000-0000-0000-0000-000000000905','fullName','P4 Member','committeeRole','MEMBER')
  )
) as id;
create temporary table p4_meeting as
select public.create_committee_meeting_command(
  '90000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY',(select id from p4_committee),
  'P4-MTG-001','2026-12-05 10:00+00','Committee room'
) as id;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000903',false);
select public.record_meeting_attendance_command(
  '90000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY',(select id from p4_meeting),
  jsonb_build_array(
    jsonb_build_object('memberId',(select id from public.institutional_committee_members where committee_id=(select id from p4_committee) and committee_role='CHAIR'),'status','PRESENT'),
    jsonb_build_object('memberId',(select id from public.institutional_committee_members where committee_id=(select id from p4_committee) and committee_role='SECRETARY'),'status','PRESENT'),
    jsonb_build_object('memberId',(select id from public.institutional_committee_members where committee_id=(select id from p4_committee) and committee_role='MEMBER'),'status','PRESENT')
  )
);
create temporary table p4_review1 as
select public.open_committee_review_command(
  '90000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY',(select id from p4_activity),(select id from p4_rev1),(select id from p4_meeting)
) as id;
select public.record_collective_assessment_command(
  '90000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY',(select id from p4_review1),
  jsonb_build_array(jsonb_build_object('criterionCode','C01','criterionText','Scientific relevance','sourceRuleCode','ACT-GOV-001','evidenceAvailability','UPLOADED','assessment','PARTIAL','notes','Needs correction'))
);

-- Secretary cannot exercise Chair decision authority.
do $$
begin
  begin
    perform public.final_committee_decision_command(
      '90000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY',(select id from p4_review1),'RETURNED_FOR_CORRECTION','Fix criterion C01'
    );
    raise exception 'secretary unexpectedly made final decision';
  exception when others then
    if sqlerrm='secretary unexpectedly made final decision' then raise; end if;
    if sqlstate<>'42501' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000904',false);
select public.final_committee_decision_command(
  '90000000-0000-0000-0000-000000000010','COMMITTEE_CHAIR',(select id from p4_review1),'RETURNED_FOR_CORRECTION','Fix criterion C01'
);
select public._assert((select internal_state from public.activities where id=(select id from p4_activity))='RETURNED','Chair return creates returned workflow state');
select public._assert((select revision_no from public.activity_revisions where activity_id=(select id from p4_activity) and status='WORKING')=2,'Chair return creates immutable revision N+1 working copy');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000902',false);
select public.save_activity_intake_command(
  '90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p4_activity),
  jsonb_build_object(
    'profile',jsonb_build_object(
      'intakeRoute','DIGITAL','specialty','Medical Education','activityLanguages',jsonb_build_array('EN'),
      'targetAudience','Healthcare professionals','selectAllMedicalFields',false,
      'learningGap','Corrected measured governance gap','aimAndOutcomes','Improve governed practice',
      'learningMethods','Interactive case discussion','participantEvaluationMethod','Post-test',
      'activityScope','LOCAL','formStatus','CONFIRMED'
    ),
    'needsAssessmentTools',jsonb_build_array(jsonb_build_object('toolCode','SURVEY')),
    'objectives',jsonb_build_array(jsonb_build_object('objectiveText','Apply governed workflow','learningDomain','SKILL','sortOrder',1)),
    'committeeMembers',jsonb_build_array(
      jsonb_build_object('fullName','Activity Member 1','classificationNumber','A1','sortOrder',1),
      jsonb_build_object('fullName','Activity Member 2','classificationNumber','A2','sortOrder',2)
    ),
    'speakers','[]'::jsonb,'sessions','[]'::jsonb,'disclosures','[]'::jsonb
  )
);
select public.save_pre_review_command(
  '90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p4_activity),
  'PRE_REVIEW','COMPLETED','[]'::jsonb
);
create temporary table p4_rev2 as
select public.submit_activity_revision_command(
  '90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p4_activity),'Corrected submission'
) as id;
select public._assert((select revision_no from public.activity_revisions where id=(select id from p4_rev2))=2,'resubmission preserves revision number N+1');
select public._assert((select status from public.activity_revisions where id=(select id from p4_rev1))='RETURNED','prior submitted revision remains returned immutable history');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000903',false);
create temporary table p4_review2 as
select public.open_committee_review_command(
  '90000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY',(select id from p4_activity),(select id from p4_rev2),(select id from p4_meeting)
) as id;
select public.record_collective_assessment_command(
  '90000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY',(select id from p4_review2),
  jsonb_build_array(
    jsonb_build_object('criterionCode','C01','criterionText','Scientific relevance','sourceRuleCode','ACT-GOV-001','evidenceAvailability','UPLOADED','assessment','MEET'),
    jsonb_build_object('criterionCode','C02','criterionText','Learning need and objectives','sourceRuleCode','ACT-NEED-001','evidenceAvailability','UPLOADED','assessment','MEET')
  )
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000904',false);
select public.final_committee_decision_command('90000000-0000-0000-0000-000000000010','COMMITTEE_CHAIR',(select id from p4_review2),'APPROVED_FOR_SCFHS_SUBMISSION','Collective review complete');
select public._assert((select internal_state from public.activities where id=(select id from p4_activity))='APPROVED_FOR_SCFHS_SUBMISSION','Chair alone advances internal approval');
select public._assert((select status from public.activity_revisions where id=(select id from p4_rev2))='FINAL_ACCEPTED','approved revision is final accepted snapshot');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000903',false);
create temporary table p4_minutes as
select public.draft_committee_minutes_command('90000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY',(select id from p4_review2)) as id;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000904',false);
select public.finalize_committee_minutes_command('90000000-0000-0000-0000-000000000010','COMMITTEE_CHAIR',(select id from p4_minutes));
select public._assert((select status='FINAL' and snapshot_sha256 is not null from public.committee_minutes where id=(select id from p4_minutes)),'Chair finalizes hashed minutes');
select public._assert((select internal_state from public.activities where id=(select id from p4_activity))='READY_FOR_SCFHS_SUBMISSION','final Chair-approved minutes advance internally approved activity to SCFHS submission readiness');

reset role;
do $$
begin
  begin
    update public.committee_minutes set snapshot_json=jsonb_build_object('tampered',true) where id=(select id from p4_minutes);
    raise exception 'final minutes unexpectedly mutated';
  exception when others then
    if sqlerrm='final minutes unexpectedly mutated' then raise; end if;
    if position('immutable' in lower(sqlerrm))=0 then raise; end if;
  end;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000903',false);
create temporary table p4_correction as
select public.request_minutes_correction_command('90000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY',(select id from p4_minutes),'Correct a documented minutes issue') as id;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000904',false);
create temporary table p4_minutes_v2 as
select public.approve_minutes_correction_command('90000000-0000-0000-0000-000000000010','COMMITTEE_CHAIR',(select id from p4_correction)) as id;
select public._assert((select status from public.committee_minutes where id=(select id from p4_minutes))='SUPERSEDED','correction preserves prior final minutes as superseded');
select public._assert((select version_no from public.committee_minutes where id=(select id from p4_minutes_v2))=2,'approved correction creates a new minutes version');
select public.finalize_committee_minutes_command('90000000-0000-0000-0000-000000000010','COMMITTEE_CHAIR',(select id from p4_minutes_v2));
select public._assert((select status from public.committee_minutes where id=(select id from p4_minutes_v2))='FINAL','corrected minutes version can be finalized without deleting history');
select public._assert((select internal_state from public.activities where id=(select id from p4_activity))='READY_FOR_SCFHS_SUBMISSION','minutes correction does not regress external submission readiness');

reset role;