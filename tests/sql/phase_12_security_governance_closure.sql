\set ON_ERROR_STOP on

select public._assert(
  not has_function_privilege('authenticated','public.log_audit_event(uuid,uuid,text,text,text,uuid,jsonb,jsonb,inet,text,text)','EXECUTE'),
  'authenticated callers cannot fabricate audit events'
);
select public._assert(
  not has_function_privilege('authenticated','public.verify_audit_chain(uuid)','EXECUTE'),
  'authenticated callers cannot run full audit-chain verification'
);
select public._assert(
  has_function_privilege('service_role','public.verify_audit_chain(uuid)','EXECUTE'),
  'trusted operational role retains audit-chain verification'
);
select public._assert(
  not has_function_privilege('authenticated','public.save_pre_review_command(uuid,text,uuid,text,text,jsonb)','EXECUTE'),
  'legacy client-computed pre-review persistence is closed'
);
select public._assert(
  has_function_privilege('service_role','public.save_pre_review_server_command(uuid,uuid,text,uuid,text,text,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','public.save_pre_review_server_command(uuid,uuid,text,uuid,text,text,jsonb)','EXECUTE'),
  'pre-review persistence is server-only'
);
select public._assert(
  to_regprocedure('public.resolve_source_conflict_command(uuid,text,uuid,text,uuid)') is null,
  'unsafe legacy source-conflict overload is removed'
);
select public._assert(
  to_regprocedure('public.approve_external_ai_privacy_command(uuid,text,boolean)') is null,
  'legacy privacy approval RPC without evidence is removed'
);

select public._assert(
  not has_table_privilege('authenticated','public.extraction_field_results','INSERT,UPDATE,DELETE'),
  'extraction results are command-write-only'
);
select public._assert(
  not has_table_privilege('authenticated','public.reference_documents','INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','public.regulatory_rules','INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','public.rule_versions','INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','public.source_conflict_resolutions','INSERT,UPDATE,DELETE'),
  'reference governance tables are command-write-only'
);
select public._assert(
  exists(select 1 from pg_trigger where tgrelid='public.meeting_attendance'::regclass and tgname='meeting_attendance_committee_guard' and not tgisinternal),
  'attendance committee relationship guard is installed'
);
select public._assert(
  exists(select 1 from pg_trigger where tgrelid='public.source_conflict_resolutions'::regclass and tgname='source_conflict_selection_guard' and not tgisinternal),
  'source-conflict selection guard is installed'
);

-- A role without impact/committee read permissions receives no protected rows,
-- even while it remains an active tenant member.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000905',false);
select public._assert(
  (select count(*) from public.impact_reports where organization_id='90000000-0000-0000-0000-000000000010')=0,
  'committee member without impact.view cannot query impact reports directly'
);
select public._assert(
  (select count(*) from public.impact_correction_requests where organization_id='90000000-0000-0000-0000-000000000010')=0,
  'committee member without impact.view cannot query impact correction requests directly'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000902',false);
select public._assert(
  (select count(*) from public.committee_reviews where organization_id='90000000-0000-0000-0000-000000000010')=0,
  'activity officer cannot query committee review records directly'
);

do $$
begin
  begin
    perform public.log_audit_event(
      '90000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000902','ACTIVITY_OFFICER',
      'fabricated.approval','activity',null,null,null,null,null,null
    );
    raise exception 'authenticated audit fabrication unexpectedly succeeded';
  exception when others then
    if sqlerrm='authenticated audit fabrication unexpectedly succeeded' then raise; end if;
    if sqlstate<>'42501' then raise; end if;
  end;
end $$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
create temporary table p12_unassigned_activity as
select * from public.create_activity_command(
  '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',
  'نشاط غير مسند لاختبار الأمان','Unassigned Security Test Activity','COURSE',null,
  '2026-12-20','2026-12-20','GROUP_INTERACTIVE',2026
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000902',false);
do $$
begin
  begin
    perform public.record_impact_level_command(
      '90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p12_unassigned_activity),
      'L1',90,'{}'::jsonb
    );
    raise exception 'unassigned impact mutation unexpectedly succeeded';
  exception when others then
    if sqlerrm='unassigned impact mutation unexpectedly succeeded' then raise; end if;
    if sqlstate<>'42501' then raise; end if;
  end;
end $$;

do $$
begin
  begin
    perform public.generate_impact_report_command(
      '90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p12_unassigned_activity),'FINAL'
    );
    raise exception 'unassigned impact finalization unexpectedly succeeded';
  exception when others then
    if sqlerrm='unassigned impact finalization unexpectedly succeeded' then raise; end if;
    if sqlstate<>'42501' then raise; end if;
  end;
end $$;

reset role;
select public._assert(
  not exists(
    select 1 from public.organization_ai_settings
    where (external_ai_enabled or privacy_approved)
      and (nullif(trim(coalesce(privacy_approval_reference,'')),'') is null or approved_by is null or approved_at is null)
  ),
  'enabled external AI always carries approval evidence and approver metadata'
);
