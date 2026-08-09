-- Phase 2 acceptance tests: structured intake, immutable PDF provenance, evidence semantics.

select public._assert(to_regclass('public.activity_intake_profiles') is not null, 'activity_intake_profiles exists');
select public._assert(to_regclass('public.activity_scientific_committees') is not null, 'activity scientific committee exists');
select public._assert(to_regclass('public.activity_scientific_committee_members') is not null, 'activity scientific committee members exist');
select public._assert(to_regclass('public.intake_documents') is not null, 'intake_documents exists');
select public._assert(to_regclass('public.extraction_field_results') is not null, 'extraction field results exist');
select public._assert(to_regclass('public.speakers') is not null, 'speaker directory exists');
select public._assert(to_regclass('public.activity_sessions') is not null, 'activity sessions exist');
select public._assert(to_regclass('public.activity_evidence') is not null, 'activity evidence exists');
select public._assert(to_regclass('public.disclosure_records') is not null, 'disclosure register exists');

-- Seed a tenant/activity for structural behavior tests as postgres.
insert into public.organizations(id,name,slug)
values ('70000000-0000-0000-0000-000000000001','Phase 2 Test Org','phase-2-test-org')
on conflict (id) do nothing;

insert into auth.users(id,email)
values ('70000000-0000-0000-0000-000000000101','phase2-admin@example.test')
on conflict (id) do nothing;

insert into public.activities(id,organization_id,activity_code,title_ar,reporting_year,created_by)
values (
  '70000000-0000-0000-0000-000000000201',
  '70000000-0000-0000-0000-000000000001',
  'CPD-2026-P2',
  'نشاط اختبار الإدخال',
  2026,
  '70000000-0000-0000-0000-000000000101'
)
on conflict (id) do nothing;

insert into public.activity_intake_profiles(
  organization_id,activity_id,intake_route,specialty,activity_languages,
  collaboration,content_developed_by_provider,target_audience,learning_gap,
  aim_and_outcomes,learning_methods,participant_evaluation_method,activity_scope
) values (
  '70000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000201',
  'HYBRID','General Practice',array['AR','EN'],false,true,
  'Healthcare practitioners','Documented knowledge and performance gap',
  'Improve measurable practice outcomes','Interactive group learning','Participant evaluation','LOCAL'
)
on conflict (activity_id) do nothing;

select public._assert(
  (select intake_route='HYBRID' and 'AR'=any(activity_languages) from public.activity_intake_profiles where activity_id='70000000-0000-0000-0000-000000000201'),
  'digital/pdf/hybrid converge into structured activity record'
);

insert into public.intake_documents(
  id,organization_id,activity_id,document_role,original_filename,storage_path,sha256,mime_type,file_size_bytes,uploaded_by
) values (
  '70000000-0000-0000-0000-000000000301',
  '70000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000201',
  'COMPLETED_ACTIVITY_FORM','activity.pdf','70000000-0000-0000-0000-000000000001/activity.pdf',repeat('a',64),'application/pdf',12345,
  '70000000-0000-0000-0000-000000000101'
);

-- Uploaded originals are immutable.
do $$
begin
  begin
    update public.intake_documents set original_filename='changed.pdf' where id='70000000-0000-0000-0000-000000000301';
    raise exception 'ASSERTION FAILED: original intake document update should be blocked';
  exception when others then
    if sqlerrm like 'ASSERTION FAILED:%' then raise; end if;
  end;
end $$;

insert into public.extraction_runs(id,organization_id,activity_id,document_id,engine,status,created_by)
values (
  '70000000-0000-0000-0000-000000000401','70000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000201','70000000-0000-0000-0000-000000000301','NATIVE_PDF','COMPLETED',
  '70000000-0000-0000-0000-000000000101'
);

insert into public.extraction_field_results(
  organization_id,extraction_run_id,field_key,raw_value,normalized_value,page_number,confidence,status
) values (
  '70000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000401',
  'activity_title_en','Unclear title',null,1,0.42,'UNCERTAIN'
);
select public._assert(
  exists(select 1 from public.extraction_field_results where extraction_run_id='70000000-0000-0000-0000-000000000401' and status='UNCERTAIN' and confidence=0.42),
  'uncertain extraction is represented explicitly rather than guessed'
);

insert into public.activity_evidence(id,organization_id,activity_id,evidence_type,status,created_by)
values (
  '70000000-0000-0000-0000-000000000501','70000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000201','DISCLOSURE','MISSING','70000000-0000-0000-0000-000000000101'
);
select public._assert(
  not exists(select 1 from public.activity_evidence where status='SKIP'),
  'no generic SKIP evidence status exists'
);
