\set ON_ERROR_STOP on

select public._assert(
  has_function_privilege(
    'authenticated',
    'public.list_activity_dossiers_command(uuid,text,integer,uuid,text)',
    'EXECUTE'
  ),
  'authenticated users can invoke the governed dossier list'
);
select public._assert(
  not has_function_privilege(
    'anon',
    'public.resolve_activity_document_download_command(uuid,text,uuid,text,uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot resolve private dossier documents'
);

insert into public.departments(
  id, organization_id, code, name_ar, name_en
) values (
  '95000000-0000-0000-0000-000000000015',
  '90000000-0000-0000-0000-000000000010',
  'P15-QI', 'الجودة - اختبار الملف', 'Quality - Dossier Test'
) on conflict (id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);

create temporary table p15_assigned as
select * from public.create_activity_command(
  '90000000-0000-0000-0000-000000000010',
  'ORGANIZATION_SYSTEM_ADMIN',
  'P15-DOSSIER النشاط المسند', 'P15-DOSSIER Assigned Program',
  'COURSE', '95000000-0000-0000-0000-000000000015',
  '2026-08-20', '2026-08-20', 'GROUP_INTERACTIVE', 2026
);
create temporary table p15_unassigned as
select * from public.create_activity_command(
  '90000000-0000-0000-0000-000000000010',
  'ORGANIZATION_SYSTEM_ADMIN',
  'P15-DOSSIER النشاط غير المسند', 'P15-DOSSIER Unassigned Program',
  'COURSE', '95000000-0000-0000-0000-000000000015',
  '2026-08-21', '2026-08-21', 'GROUP_INTERACTIVE', 2026
);
select public.assign_activity_officer_command(
  '90000000-0000-0000-0000-000000000010',
  'ORGANIZATION_SYSTEM_ADMIN',
  (select id from p15_assigned),
  '93000000-0000-0000-0000-000000000002'
);

reset role;
insert into public.intake_documents(
  id, organization_id, activity_id, document_role, original_filename,
  storage_path, sha256, mime_type, file_size_bytes, uploaded_by
) values (
  '95000000-0000-0000-0000-000000000115',
  '90000000-0000-0000-0000-000000000010',
  (select id from p15_assigned),
  'COMPLETED_ACTIVITY_FORM', 'official-form-p15.docx',
  '90000000-0000-0000-0000-000000000010/p15/official-form.docx',
  repeat('a',64),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  4096, '00000000-0000-0000-0000-000000000902'
);
insert into public.impact_reports(
  organization_id, activity_id, kind, version_no, status,
  htvi_status, snapshot_json, snapshot_sha256, generated_by
) values
  (
    '90000000-0000-0000-0000-000000000010', (select id from p15_assigned),
    'INTERIM', 1, 'DRAFT', 'PENDING', '{"test":"assigned"}', repeat('b',64),
    '00000000-0000-0000-0000-000000000902'
  ),
  (
    '90000000-0000-0000-0000-000000000010', (select id from p15_unassigned),
    'INTERIM', 1, 'DRAFT', 'PENDING', '{"test":"unassigned"}', repeat('c',64),
    '00000000-0000-0000-0000-000000000901'
  );

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000902',false);

select public._assert(
  (
    select count(*) from public.list_activity_dossiers_command(
      '90000000-0000-0000-0000-000000000010',
      'ACTIVITY_OFFICER', 2026,
      '95000000-0000-0000-0000-000000000015', 'P15-DOSSIER'
    )
  ) = 1,
  'Activity Officer sees all and only assigned activities'
);
select public._assert(
  (
    select title_en from public.list_activity_dossiers_command(
      '90000000-0000-0000-0000-000000000010',
      'ACTIVITY_OFFICER', 2026,
      '95000000-0000-0000-0000-000000000015', 'assigned program'
    )
  ) = 'P15-DOSSIER Assigned Program',
  'year, department and bilingual search use AND semantics'
);
select public._assert(
  (
    select count(*) from public.impact_reports
    where organization_id = '90000000-0000-0000-0000-000000000010'
      and activity_id in ((select id from p15_assigned),(select id from p15_unassigned))
  ) = 1,
  'Activity Officer direct impact reads are assignment scoped by RLS'
);
select public._assert(
  (
    select count(*) from public.committee_decisions
    where organization_id = '90000000-0000-0000-0000-000000000010'
  ) >= 1
  and (
    select count(*) from public.committee_minutes
    where organization_id = '90000000-0000-0000-0000-000000000010'
      and status = 'FINAL'
  ) >= 1,
  'assigned Activity Officer can read committee approval and final minutes'
);
select public._assert(
  position(
    'storage_path' in public.get_activity_dossier_command(
      '90000000-0000-0000-0000-000000000010',
      'ACTIVITY_OFFICER', (select id from p15_assigned)
    )::text
  ) = 0,
  'dossier metadata never exposes private storage paths'
);
select public._assert(
  (
    select storage_path
    from public.resolve_activity_document_download_command(
      '90000000-0000-0000-0000-000000000010',
      'ACTIVITY_OFFICER', (select id from p15_assigned),
      'INTAKE_DOCUMENT', '95000000-0000-0000-0000-000000000115'
    )
  ) = '90000000-0000-0000-0000-000000000010/p15/official-form.docx',
  'assigned Activity Officer can resolve the official uploaded form'
);

do $$
begin
  begin
    perform public.get_activity_dossier_command(
      '90000000-0000-0000-0000-000000000010',
      'ACTIVITY_OFFICER', (select id from p15_unassigned)
    );
    raise exception 'unassigned dossier unexpectedly resolved';
  exception when others then
    if sqlerrm = 'unassigned dossier unexpectedly resolved' then raise; end if;
    if sqlstate <> '42501' then raise; end if;
  end;
end $$;

do $$
begin
  begin
    perform public.resolve_activity_document_download_command(
      '90000000-0000-0000-0000-000000000010',
      'ACTIVITY_OFFICER', (select id from p15_unassigned),
      'INTAKE_DOCUMENT', '95000000-0000-0000-0000-000000000115'
    );
    raise exception 'unassigned document unexpectedly resolved';
  exception when others then
    if sqlerrm = 'unassigned document unexpectedly resolved' then raise; end if;
    if sqlstate <> '42501' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000903',false);
select public._assert(
  (
    select count(*) from public.list_activity_dossiers_command(
      '90000000-0000-0000-0000-000000000010',
      'COMMITTEE_SECRETARY', 2026,
      '95000000-0000-0000-0000-000000000015', 'P15-DOSSIER'
    )
  ) = 2,
  'Committee Secretary sees every organization activity'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000904',false);
select public._assert(
  (
    select count(*) from public.list_activity_dossiers_command(
      '90000000-0000-0000-0000-000000000010',
      'COMMITTEE_CHAIR', 2026,
      '95000000-0000-0000-0000-000000000015', 'P15-DOSSIER'
    )
  ) = 2,
  'Committee Chair sees every organization activity'
);

reset role;
