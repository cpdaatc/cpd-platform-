\set ON_ERROR_STOP on

insert into auth.users(id,email) values
  ('00000000-0000-0000-0000-000000000901','phase4-admin@example.test'),
  ('00000000-0000-0000-0000-000000000902','phase4-officer@example.test'),
  ('00000000-0000-0000-0000-000000000903','phase4-secretary@example.test'),
  ('00000000-0000-0000-0000-000000000904','phase4-chair@example.test'),
  ('00000000-0000-0000-0000-000000000905','phase4-member@example.test')
on conflict(id) do nothing;
insert into public.users(id,display_name) values
  ('00000000-0000-0000-0000-000000000901','P4 Admin'),
  ('00000000-0000-0000-0000-000000000902','P4 Officer'),
  ('00000000-0000-0000-0000-000000000903','P4 Secretary'),
  ('00000000-0000-0000-0000-000000000904','P4 Chair'),
  ('00000000-0000-0000-0000-000000000905','P4 Member')
on conflict(id) do nothing;
insert into public.organizations(id,name,slug) values
  ('90000000-0000-0000-0000-000000000010','Phase 4 Committee Org','phase4-committee')
on conflict(id) do nothing;
insert into public.organization_memberships(id,organization_id,user_id) values
  ('93000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000901'),
  ('93000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000902'),
  ('93000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000903'),
  ('93000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000904'),
  ('93000000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000905')
on conflict(id) do nothing;
insert into public.user_roles(organization_id,membership_id,role_id)
select '90000000-0000-0000-0000-000000000010','93000000-0000-0000-0000-000000000001',id from public.roles where code='ORGANIZATION_SYSTEM_ADMIN'
on conflict do nothing;
insert into public.user_roles(organization_id,membership_id,role_id)
select '90000000-0000-0000-0000-000000000010','93000000-0000-0000-0000-000000000002',id from public.roles where code='ACTIVITY_OFFICER'
on conflict do nothing;
insert into public.user_roles(organization_id,membership_id,role_id)
select '90000000-0000-0000-0000-000000000010','93000000-0000-0000-0000-000000000003',id from public.roles where code='COMMITTEE_SECRETARY'
on conflict do nothing;
insert into public.user_roles(organization_id,membership_id,role_id)
select '90000000-0000-0000-0000-000000000010','93000000-0000-0000-0000-000000000004',id from public.roles where code='COMMITTEE_CHAIR'
on conflict do nothing;
insert into public.user_roles(organization_id,membership_id,role_id)
select '90000000-0000-0000-0000-000000000010','93000000-0000-0000-0000-000000000005',id from public.roles where code='COMMITTEE_MEMBER'
on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
create temporary table p4_committee as
select public.configure_institutional_committee_command(
  '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN','Institutional Scientific Review Committee','APPT-2026-01','2026-01-01','Hospital Management','2026-01-01',null,
  jsonb_build_array(
    jsonb_build_object('userId','00000000-0000-0000-0000-000000000904','fullName','P4 Chair','committeeRole','CHAIR'),
    jsonb_build_object('userId','00000000-0000-0000-0000-000000000903','fullName','P4 Secretary','committeeRole','SECRETARY'),
    jsonb_build_object('userId','00000000-0000-0000-0000-000000000905','fullName','P4 Member','committeeRole','MEMBER')
  )
) as id;

create temporary table p4_activity as
select * from public.create_activity_command(
  '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN','نشاط اللجنة','Committee Activity','COURSE',null,'2026-12-01','2026-12-01','GROUP_INTERACTIVE',2026
);
select public.assign_activity_officer_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',(select id from p4_activity),'93000000-0000-0000-0000-000000000002');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000902',false);
select public.save_activity_intake_command(
  '90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p4_activity),
  jsonb_build_object(
    'profile',jsonb_build_object('intakeRoute','DIGITAL','specialty','Quality','activityLanguages',jsonb_build_array('AR'),'collaboration',false,'contentDevelopedByProvider',true,'targetAudience','Practitioners','selectAllMedicalFields',false,'learningGap','Documented gap v1','aimAndOutcomes','Improve practice','learningMethods','Interactive workshop','participantEvaluationMethod','Observed checklist','activityScope','LOCAL','formStatus','CONFIRMED'),
    'needsAssessmentTools',jsonb_build_array(jsonb_build_object('toolCode','SURVEY')),
    'objectives',jsonb_build_array(jsonb_build_object('objectiveText','Demonstrate correct protocol','learningDomain','SKILL','sortOrder',1)),
    'committeeMembers',jsonb_build_array(jsonb_build_object('fullName','ASC Member 1','sortOrder',1),jsonb_build_object('fullName','ASC Member 2','sortOrder',2)),
    'speakers',jsonb_build_array(jsonb_build_object('clientKey','spk-p4','fullName','Speaker P4','sortOrder',1)),
    'sessions',jsonb_build_array(jsonb_build_object('topicName','Practice','sortOrder',1,'speakerKeys',jsonb_build_array('spk-p4'))),
    'disclosures',jsonb_build_array(jsonb_build_object('personName','Speaker P4','personRole','SPEAKER','declarationStatus','DECLARED_NO_CONFLICT'))
  )
);
select public.save_pre_review_command(
  '90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p4_activity),'ruleset-1.0','p4-v1',
  jsonb_build_array(jsonb_build_object('ruleCode','ACT-READINESS-SUMMARY','sourceCode','INTERNAL_READINESS_ENGINE','sourceVersion','1.0','evidenceLocation','activity_record','status','ALIGNED','severity','ADVISORY','rationale','Ready for human review','recommendation','Proceed to committee review','confidence',1))
);
create temporary table p4_rev1 as
select public.submit_activity_revision_command('90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p4_activity),null) as id;
select public._assert((select internal_state from public.activities where id=(select id from p4_activity))='READY_FOR_COMMITTEE','submission advances to READY_FOR_COMMITTEE');
select public._assert((select snapshot_sha256 is not null from public.activity_revisions where id=(select id from p4_rev1)),'submitted revision is hashed');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000903',false);
create temporary table p4_meeting as
select public.create_committee_meeting_command('90000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY','2026-11-01 10:00+03','Meeting Room','MTG-01') as id;
select public.record_meeting_attendance_command(
  '90000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY',(select id from p4_meeting),
  (select jsonb_agg(jsonb_build_object('committeeMemberId',m.id,'status','PRESENT')) from public.institutional_committee_members m where m.committee_id=(select id from p4_committee))
);
create temporary table p4_review1 as
select public.open_committee_review_command('90000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY',(select id from p4_activity),(select id from p4_meeting)) as id;
select public.record_collective_assessment_command(
  '90000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY',(select id from p4_review1),
  jsonb_build_array(
    jsonb_build_object('criterionCode','C01','criterionText','Scientific relevance','sourceRuleCode','ACT-GOV-001','evidenceAvailability','UPLOADED','assessment','MEET'),
    jsonb_build_object('criterionCode','C02','criterionText','Learning need and objectives','sourceRuleCode','ACT-NEED-001','evidenceAvailability','UPLOADED','assessment','PARTIAL','notes','Clarify the gap','correctiveAction','Revise gap statement')
  )
);

do $$
begin
  begin
    perform public.final_committee_decision_command('90000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY',(select id from p4_review1),'RETURNED_FOR_CORRECTION','Needs correction');
    raise exception 'secretary unexpectedly made final decision';
  exception when others then
    if sqlerrm='secretary unexpectedly made final decision' then raise; end if;
    if sqlstate<>'42501' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000904',false);
select public.final_committee_decision_command('90000000-0000-0000-0000-000000000010','COMMITTEE_CHAIR',(select id from p4_review1),'RETURNED_FOR_CORRECTION','Revise learning gap');
select public._assert((select internal_state from public.activities where id=(select id from p4_activity))='RETURNED_FOR_CORRECTION','Chair return moves activity to correction state');
select public._assert((select status from public.activity_revisions where id=(select id from p4_rev1))='RETURNED','submitted revision remains historical and marked returned');
select public._assert((select count(*) from public.activity_revisions where activity_id=(select id from p4_activity) and status='WORKING')=1,'return creates one working N+1 revision');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000902',false);
select public.save_activity_intake_command(
  '90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p4_activity),
  jsonb_build_object(
    'profile',jsonb_build_object('intakeRoute','DIGITAL','specialty','Quality','activityLanguages',jsonb_build_array('AR'),'collaboration',false,'contentDevelopedByProvider',true,'targetAudience','Practitioners','selectAllMedicalFields',false,'learningGap','Clarified documented gap v2','aimAndOutcomes','Improve practice','learningMethods','Interactive workshop','participantEvaluationMethod','Observed checklist','activityScope','LOCAL','formStatus','CONFIRMED'),
    'needsAssessmentTools',jsonb_build_array(jsonb_build_object('toolCode','SURVEY')),
    'objectives',jsonb_build_array(jsonb_build_object('objectiveText','Demonstrate correct protocol','learningDomain','SKILL','sortOrder',1)),
    'committeeMembers',jsonb_build_array(jsonb_build_object('fullName','ASC Member 1','sortOrder',1),jsonb_build_object('fullName','ASC Member 2','sortOrder',2)),
    'speakers',jsonb_build_array(jsonb_build_object('clientKey','spk-p4','fullName','Speaker P4','sortOrder',1)),
    'sessions',jsonb_build_array(jsonb_build_object('topicName','Practice','sortOrder',1,'speakerKeys',jsonb_build_array('spk-p4'))),
    'disclosures',jsonb_build_array(jsonb_build_object('personName','Speaker P4','personRole','SPEAKER','declarationStatus','DECLARED_NO_CONFLICT'))
  )
);
select public.save_pre_review_command(
  '90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p4_activity),'ruleset-1.0','p4-v2',
  jsonb_build_array(jsonb_build_object('ruleCode','ACT-READINESS-SUMMARY','sourceCode','INTERNAL_READINESS_ENGINE','sourceVersion','1.0','evidenceLocation','activity_record','status','ALIGNED','severity','ADVISORY','rationale','Corrected record ready','recommendation','Proceed to committee review','confidence',1))
);
create temporary table p4_rev2 as
select public.submit_activity_revision_command('90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p4_activity),'Clarified the learning gap after committee return') as id;
select public._assert((select revision_no from public.activity_revisions where id=(select id from p4_rev2))=2,'resubmission freezes Revision N+1');
select public._assert((select parent_revision_id from public.activity_revisions where id=(select id from p4_rev2))=(select id from p4_rev1),'Revision N+1 preserves parent link');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000903',false);
create temporary table p4_review2 as
select public.open_committee_review_command('90000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY',(select id from p4_activity),(select id from p4_meeting)) as id;
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
select public._assert((select internal_state from public.activities where id=(select id from p4_activity))='READY_FOR_SCFHS_SUBMISSION','final Chair-approved minutes advance internal approval to SCFHS submission readiness');

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
select public._assert((select internal_state from public.activities where id=(select id from p4_activity))='READY_FOR_SCFHS_SUBMISSION','corrected final minutes do not regress external submission readiness');

reset role;