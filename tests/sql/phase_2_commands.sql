\set ON_ERROR_STOP on

insert into auth.users(id,email) values
  ('00000000-0000-0000-0000-000000000701','phase2-admin@example.test'),
  ('00000000-0000-0000-0000-000000000702','phase2-officer@example.test'),
  ('00000000-0000-0000-0000-000000000703','phase2-secretary@example.test'),
  ('00000000-0000-0000-0000-000000000704','phase2-chair@example.test')
on conflict (id) do nothing;

insert into public.users(id,display_name) values
  ('00000000-0000-0000-0000-000000000701','P2 Admin'),
  ('00000000-0000-0000-0000-000000000702','P2 Officer'),
  ('00000000-0000-0000-0000-000000000703','P2 Secretary'),
  ('00000000-0000-0000-0000-000000000704','P2 Chair')
on conflict (id) do nothing;

insert into public.organizations(id,name,slug) values
  ('70000000-0000-0000-0000-000000000010','Phase 2 Commands Org','phase2-commands')
on conflict (id) do nothing;

insert into public.organization_memberships(id,organization_id,user_id) values
  ('73000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000701'),
  ('73000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000702'),
  ('73000000-0000-0000-0000-000000000003','70000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000703'),
  ('73000000-0000-0000-0000-000000000004','70000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000704')
on conflict (id) do nothing;

insert into public.user_roles(organization_id,membership_id,role_id)
select '70000000-0000-0000-0000-000000000010','73000000-0000-0000-0000-000000000001',id from public.roles where code='ORGANIZATION_SYSTEM_ADMIN'
on conflict do nothing;
insert into public.user_roles(organization_id,membership_id,role_id)
select '70000000-0000-0000-0000-000000000010','73000000-0000-0000-0000-000000000002',id from public.roles where code='ACTIVITY_OFFICER'
on conflict do nothing;
insert into public.user_roles(organization_id,membership_id,role_id)
select '70000000-0000-0000-0000-000000000010','73000000-0000-0000-0000-000000000003',id from public.roles where code='COMMITTEE_SECRETARY'
on conflict do nothing;
insert into public.user_roles(organization_id,membership_id,role_id)
select '70000000-0000-0000-0000-000000000010','73000000-0000-0000-0000-000000000004',id from public.roles where code='COMMITTEE_CHAIR'
on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000701',false);
create temporary table p2_activity as
select * from public.create_activity_command(
  '70000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',
  'نشاط المرحلة الثانية','Phase 2 Activity','COURSE',null,'2026-10-01','2026-10-01','GROUP_INTERACTIVE',2026
);
select public.assign_activity_officer_command(
  '70000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',(select id from p2_activity),'73000000-0000-0000-0000-000000000002'
);

-- Secretary cannot use the intake preparation permission merely because the secretary can review later.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000703',false);
do $$
begin
  begin
    perform public.save_activity_intake_command(
      '70000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY',(select id from p2_activity),
      '{"profile":{"intakeRoute":"DIGITAL"}}'::jsonb
    );
    raise exception 'secretary unexpectedly edited activity intake';
  exception when others then
    if sqlerrm='secretary unexpectedly edited activity intake' then raise; end if;
    if sqlstate <> '42501' then raise; end if;
  end;
end $$;

-- Assigned Activity Officer may create the complete structured record atomically.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000702',false);
select public.save_activity_intake_command(
  '70000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p2_activity),
  jsonb_build_object(
    'profile',jsonb_build_object(
      'intakeRoute','HYBRID','specialty','Patient Safety','activityLanguages',jsonb_build_array('AR','EN'),
      'collaboration',false,'contentDevelopedByProvider',true,'targetAudience','Healthcare practitioners',
      'selectAllMedicalFields',false,'learningGap','A measurable gap in reporting practice',
      'aimAndOutcomes','Improve reporting practice','learningMethods','Interactive group learning',
      'participantEvaluationMethod','Structured participant evaluation','activityScope','LOCAL','formStatus','CONFIRMED'
    ),
    'needsAssessmentTools',jsonb_build_array(jsonb_build_object('toolCode','SURVEY')),
    'objectives',jsonb_build_array(jsonb_build_object('objectiveText','Apply the reporting protocol correctly','learningDomain','SKILL','sortOrder',1)),
    'committeeMembers',jsonb_build_array(
      jsonb_build_object('fullName','Activity Committee Member 1','classificationNumber','1001','specialty','Patient Safety','sortOrder',1),
      jsonb_build_object('fullName','Activity Committee Member 2','classificationNumber','1002','specialty','Quality','sortOrder',2)
    ),
    'speakers',jsonb_build_array(jsonb_build_object('clientKey','spk-1','fullName','Demo Speaker','specialty','Patient Safety','grade','Consultant','institution','Demo Institution','sortOrder',1)),
    'sessions',jsonb_build_array(jsonb_build_object('dayLabel','Day 1','topicName','Safe reporting','sortOrder',1,'speakerKeys',jsonb_build_array('spk-1'))),
    'disclosures',jsonb_build_array(jsonb_build_object('personName','Demo Speaker','personRole','SPEAKER','declarationStatus','DECLARED_NO_CONFLICT'))
  )
);

select public._assert(
  (select internal_state from public.activities where id=(select id from p2_activity))='PLANNING_DRAFT',
  'first structured intake moves CREATED to PLANNING_DRAFT'
);
select public._assert(
  exists(select 1 from public.activity_intake_profiles where activity_id=(select id from p2_activity) and intake_route='HYBRID' and form_status='CONFIRMED'),
  'digital and PDF-capable intake converges in one structured profile'
);
select public._assert(
  (select count(*) from public.activity_scientific_committee_members m join public.activity_scientific_committees c on c.id=m.activity_scientific_committee_id where c.activity_id=(select id from p2_activity))=2,
  'activity-specific scientific committee remains activity-scoped'
);
select public._assert(
  exists(select 1 from public.audit_logs where entity_id=(select id from p2_activity) and action='activity.intake_saved' and role_context='ACTIVITY_OFFICER'),
  'intake save is audited with active role context'
);

select public.save_activity_speaker_contact_command(
  '70000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',
  (select id from public.activity_speakers where activity_id=(select id from p2_activity) and client_key='spk-1'),
  '+966500000000','speaker@example.test','SCFHS-DEMO-1'
);
select public._assert(
  exists(select 1 from public.activity_speakers where activity_id=(select id from p2_activity) and mobile_snapshot='+966500000000' and email_snapshot='speaker@example.test'),
  'speaker contact data is preserved as an activity-specific snapshot'
);

-- Uploaded evidence can later be marked offline-reviewed only by an authorized verifier.
create temporary table p2_evidence as
select public.register_activity_evidence_command(
  '70000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p2_activity),
  'DISCLOSURE','70000000-0000-0000-0000-000000000010/demo/disclosure.pdf',repeat('b',64),'Demo disclosure'
) as id;

-- Secretary records the review, but an Activity Officer cannot be claimed as verifier.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000703',false);
do $$
begin
  begin
    perform public.record_offline_evidence_review(
      (select id from p2_evidence),'00000000-0000-0000-0000-000000000702',now(),'Physical committee file',true,null
    );
    raise exception 'unauthorized verifier unexpectedly accepted';
  exception when others then
    if sqlerrm='unauthorized verifier unexpectedly accepted' then raise; end if;
  end;
end $$;

select public.record_offline_evidence_review(
  (select id from p2_evidence),'00000000-0000-0000-0000-000000000704',now(),'Physical committee file',true,null
);
select public._assert(
  exists(select 1 from public.evidence_reviews where evidence_id=(select id from p2_evidence) and recorded_by='00000000-0000-0000-0000-000000000703' and verified_by='00000000-0000-0000-0000-000000000704'),
  'OFFLINE_REVIEWED separates recorder from authorized verifier'
);

reset role;
