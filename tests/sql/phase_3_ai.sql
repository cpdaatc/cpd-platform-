\set ON_ERROR_STOP on

select public._assert(to_regclass('public.reference_documents') is not null,'reference_documents exists');
select public._assert(to_regclass('public.regulatory_rules') is not null,'regulatory_rules exists');
select public._assert(to_regclass('public.rule_versions') is not null,'rule_versions exists');
select public._assert(to_regclass('public.source_conflicts') is not null,'source_conflicts exists');
select public._assert(to_regclass('public.ai_reviews') is not null,'ai_reviews exists');
select public._assert(to_regclass('public.ai_findings') is not null,'ai_findings exists');
select public._assert(to_regclass('public.organization_ai_settings') is not null,'organization_ai_settings exists');

select public._assert(
  (select count(distinct rule_scope) from public.regulatory_rules where organization_id is null) >= 2,
  'global rules preserve distinct scopes rather than flattening sources'
);
select public._assert(
  exists(select 1 from public.regulatory_rules where rule_code='ACT-GOV-001' and rule_scope='ACTIVITY_ACCREDITATION'),
  'activity scientific committee rule is activity-scoped'
);
select public._assert(
  exists(select 1 from public.regulatory_rules where rule_code='ACT-OBJ-002' and rule_scope='EDUCATIONAL_GUIDANCE'),
  'Bloom/SMART wording is educational guidance, not mislabeled regulation'
);
select public._assert(
  not exists(select 1 from public.ai_findings where lower(status) like '%approved%' or lower(status) like '%compliance%'),
  'AI finding statuses do not claim approval/compliance'
);

insert into auth.users(id,email) values
  ('00000000-0000-0000-0000-000000000801','phase3-admin@example.test'),
  ('00000000-0000-0000-0000-000000000802','phase3-officer@example.test'),
  ('00000000-0000-0000-0000-000000000803','phase3-manager@example.test')
on conflict(id) do nothing;
insert into public.users(id,display_name) values
  ('00000000-0000-0000-0000-000000000801','P3 Admin'),
  ('00000000-0000-0000-0000-000000000802','P3 Officer'),
  ('00000000-0000-0000-0000-000000000803','P3 Manager')
on conflict(id) do nothing;
insert into public.organizations(id,name,slug) values
  ('80000000-0000-0000-0000-000000000010','Phase 3 Rules Org','phase3-rules')
on conflict(id) do nothing;
insert into public.organization_memberships(id,organization_id,user_id) values
  ('83000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000801'),
  ('83000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000802'),
  ('83000000-0000-0000-0000-000000000003','80000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000803')
on conflict(id) do nothing;
insert into public.user_roles(organization_id,membership_id,role_id)
select '80000000-0000-0000-0000-000000000010','83000000-0000-0000-0000-000000000001',id from public.roles where code='ORGANIZATION_SYSTEM_ADMIN'
on conflict do nothing;
insert into public.user_roles(organization_id,membership_id,role_id)
select '80000000-0000-0000-0000-000000000010','83000000-0000-0000-0000-000000000002',id from public.roles where code='ACTIVITY_OFFICER'
on conflict do nothing;
insert into public.user_roles(organization_id,membership_id,role_id)
select '80000000-0000-0000-0000-000000000010','83000000-0000-0000-0000-000000000003',id from public.roles where code='MANAGEMENT_APPROVER'
on conflict do nothing;

select public._assert(
  exists(select 1 from public.organization_ai_settings where organization_id='80000000-0000-0000-0000-000000000010' and external_ai_enabled=false and privacy_approved=false),
  'external AI defaults to disabled and unapproved'
);

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000801',false);
create temporary table p3_activity as
select * from public.create_activity_command(
  '80000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',
  'نشاط مراجعة المرحلة الثالثة','Phase 3 Review Activity','COURSE',null,'2026-11-01','2026-11-01','GROUP_INTERACTIVE',2026
);
select public.assign_activity_officer_command(
  '80000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',(select id from p3_activity),'83000000-0000-0000-0000-000000000002'
);

select public.configure_external_ai_command(
  '80000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN','approved-provider','approved-region','No provider retention beyond configured processing need'
);
select public._assert(
  exists(select 1 from public.organization_ai_settings where organization_id='80000000-0000-0000-0000-000000000010' and external_ai_enabled=false and privacy_approved=false and provider='approved-provider'),
  'System Admin configuration does not self-approve privacy or enable external AI'
);

do $$
begin
  begin
    perform public.approve_external_ai_command('80000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN','PDPL-TEST-ADMIN',null);
    raise exception 'admin unexpectedly approved AI privacy';
  exception when others then
    if sqlerrm='admin unexpectedly approved AI privacy' then raise; end if;
    if sqlstate <> '42501' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000803',false);
select public.approve_external_ai_command('80000000-0000-0000-0000-000000000010','MANAGEMENT_APPROVER','PDPL-TEST-APPROVAL',null);
select public._assert(
  exists(select 1 from public.organization_ai_settings where organization_id='80000000-0000-0000-0000-000000000010' and external_ai_enabled=true and privacy_approved=true and approved_by='00000000-0000-0000-0000-000000000803'),
  'Management Approver explicitly controls privacy approval and enablement'
);

reset role;
select public.save_pre_review_server_command(
  '80000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000802','ACTIVITY_OFFICER',(select id from p3_activity),'ruleset-1.0',repeat('a',64),
  jsonb_build_array(
    jsonb_build_object(
      'ruleCode','ACT-GOV-001','sourceCode','SCFHS_ACTIVITY_ACCREDITATION_STANDARDS','sourceVersion','2023',
      'evidenceLocation','activity_scientific_committee','status','MISSING_REQUIRED_INFORMATION','severity','CRITICAL',
      'rationale','Committee record incomplete','recommendation','Complete actual committee member data without fabrication','confidence',1
    )
  )
);

select public._assert(
  exists(
    select 1 from public.ai_findings f
    join public.ai_reviews r on r.id=f.ai_review_id
    where r.activity_id=(select id from p3_activity)
      and f.rule_code='ACT-GOV-001'
      and f.rule_version_id is not null
      and f.source_code='SCFHS_ACTIVITY_ACCREDITATION_STANDARDS'
      and f.source_version='2023'
  ),
  'every deterministic finding is traceable to the versioned rule/source when a rule exists'
);

select public._assert(
  exists(select 1 from public.audit_logs where entity_id=(select id from p3_activity) and action='activity.pre_review_completed' and role_context='ACTIVITY_OFFICER'),
  'pre-review completion is audited with role context'
);
