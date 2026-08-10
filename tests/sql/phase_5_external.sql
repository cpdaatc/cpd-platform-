\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);

select public._assert(
  exists(select 1 from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' and internal_state='READY_FOR_SCFHS_SUBMISSION'),
  'phase4 Chair-approved final minutes make the internally approved activity ready for external submission'
);

select public.record_external_status_command(
  '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',
  (select id from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1),
  'READY_FOR_SCFHS_SUBMISSION',null,null,'CPD_ACTIVITY',null,null,null,null,null
);
select public._assert(
  (select internal_state from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1)='READY_FOR_SCFHS_SUBMISSION',
  'external readiness state remains separate from external authority decision'
);

select public.record_external_status_command(
  '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',
  (select id from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1),
  'SUBMITTED','MUSTAMIR-TEST-001','2026-12-01','CPD_ACTIVITY',null,null,null,null,'external/submission/MUSTAMIR-TEST-001'
);
select public._assert(
  (select status from public.external_submission_records where request_number='MUSTAMIR-TEST-001')='SUBMITTED',
  'external submission status is recorded manually'
);
select public._assert(
  (select internal_state from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1)='EXTERNAL_TRACKING',
  'external tracking advances only internal workflow state'
);

do $$
begin
  begin
    perform public.record_external_status_command(
      '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',
      (select id from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1),
      'APPROVED','MUSTAMIR-TEST-001','2026-12-01','CPD_ACTIVITY',null,'ACC-001',10,'2026-12-03',null
    );
    raise exception 'external approval unexpectedly accepted without evidence';
  exception when others then
    if sqlerrm='external approval unexpectedly accepted without evidence' then raise; end if;
    if sqlstate<>'22023' then raise; end if;
  end;
end $$;

select public.record_external_status_command(
  '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',
  (select id from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1),
  'APPROVED','MUSTAMIR-TEST-001','2026-12-01','CPD_ACTIVITY',null,'ACC-001',10,'2026-12-03','external/decision/ACC-001.pdf'
);
select public._assert((select count(*) from public.external_status_history where organization_id='90000000-0000-0000-0000-000000000010')>=3,'external status history is append-style');
select public._assert(
  (select internal_state from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1)='EXTERNAL_TRACKING',
  'external APPROVED is tracked without rewriting the internal scientific committee decision'
);

reset role;
