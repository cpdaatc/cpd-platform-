\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
create temporary table p10_request as select public.request_impact_correction_command(
  '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',
  (select id from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1),
  'Correct a verified post-activity value while preserving the prior final snapshot.') as id;
select public._assert((select status from public.impact_correction_requests where id=(select id from p10_request))='REQUESTED','final impact correction starts as REQUESTED');

do $$ begin
  begin
    update public.impact_level_results set score=99 where activity_id=(select id from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1) and level='L3';
    raise exception 'finalized impact input unexpectedly editable';
  exception when others then
    if sqlerrm='finalized impact input unexpectedly editable' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000906',false);
select public.review_impact_correction_command('90000000-0000-0000-0000-000000000010','MANAGEMENT_APPROVER',(select id from p10_request),'APPROVE','Verified correction approved for a new final version.');
select public._assert((select status from public.impact_reports where id=(select final_report_id from public.impact_correction_requests where id=(select id from p10_request)))='SUPERSEDED','prior final report is preserved as SUPERSEDED');
select public._assert((select internal_state from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1)='IMPACT_FOLLOWUP','approved correction reopens impact follow-up');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
select public.record_impact_level_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',(select id from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1),'L3',99,'{"source":"verified correction"}'::jsonb);
create temporary table p10_new_final as select public.generate_impact_report_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',(select id from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1),'FINAL') as id;
select public._assert((select version_no from public.impact_reports where id=(select id from p10_new_final))>=2,'corrected final report receives a new version');
select public._assert((select status from public.impact_correction_requests where id=(select id from p10_request))='APPLIED','approved correction closes as APPLIED when new final is generated');
select public._assert((select count(*) from public.impact_reports where activity_id=(select id from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1) and kind='FINAL')>=2,'historical and current final versions both remain available');

reset role;
