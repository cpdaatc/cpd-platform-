\set ON_ERROR_STOP on

insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000906','phase6-management@example.test') on conflict(id) do nothing;
insert into public.users(id,display_name) values ('00000000-0000-0000-0000-000000000906','P6 Management') on conflict(id) do nothing;
insert into public.organization_memberships(id,organization_id,user_id) values ('93000000-0000-0000-0000-000000000006','90000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000906') on conflict(id) do nothing;
insert into public.user_roles(organization_id,membership_id,role_id)
select '90000000-0000-0000-0000-000000000010','93000000-0000-0000-0000-000000000006',id from public.roles where code='MANAGEMENT_APPROVER' on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
create temporary table p6_policy as select public.configure_impact_followup_policy_command(
  '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN','Impact Follow-up','P6-1',
  jsonb_build_array(
    jsonb_build_object('level','L1','dueOffsetDays',0,'gracePeriodDays',7,'required',true),
    jsonb_build_object('level','L2','dueOffsetDays',0,'gracePeriodDays',7,'required',true),
    jsonb_build_object('level','L3','dueOffsetDays',30,'gracePeriodDays',14,'required',true),
    jsonb_build_object('level','L4','dueOffsetDays',90,'gracePeriodDays',30,'required',true)
  )) as id;
create temporary table p6_method as select public.configure_impact_methodology_command(
  '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN','HTVI-P6',
  '{"L1":15,"L2":20,"L3":25,"L4":40}'::jsonb,
  '{"excellent":85,"very_good":75,"good":65}'::jsonb) as id;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000906',false);
select public.approve_impact_followup_policy_command('90000000-0000-0000-0000-000000000010','MANAGEMENT_APPROVER',(select id from p6_policy));
select public.approve_impact_methodology_command('90000000-0000-0000-0000-000000000010','MANAGEMENT_APPROVER',(select id from p6_method));

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
select public.mark_activity_conducted_command(
  '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',
  (select id from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1),
  now()-interval '200 days');
select public._assert((select count(*) from public.activity_impact_schedules where organization_id='90000000-0000-0000-0000-000000000010')=4,'L1-L4 schedules generated from approved policy');

select public.record_impact_level_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',(select id from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1),'L1',88.6667,'{"source":"survey"}'::jsonb);
select public.record_impact_level_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',(select id from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1),'L2',100,'{"source":"post_test"}'::jsonb);

create temporary table p6_interim as select public.generate_impact_report_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',(select id from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1),'INTERIM') as id;
select public._assert((select htvi_status from public.impact_reports where id=(select id from p6_interim))='PENDING','interim HTVI is PENDING');
select public._assert((select htvi_score is null from public.impact_reports where id=(select id from p6_interim)),'interim HTVI has no partial score');

do $$
begin
  begin
    perform public.generate_impact_report_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',(select id from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1),'FINAL');
    raise exception 'final report unexpectedly generated with incomplete levels';
  exception when others then
    if sqlerrm='final report unexpectedly generated with incomplete levels' then raise; end if;
    if sqlstate<>'22023' then raise; end if;
  end;
end $$;

select public.record_impact_level_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',(select id from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1),'L3',100,'{"source":"followup"}'::jsonb);
select public.record_impact_objectives_command(
  '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',
  (select id from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1),
  jsonb_build_array(jsonb_build_object('objectiveText','Reference L4 objective','impactDomain','PATIENT_IMPACT','indicator','Reference indicator','direction','INCREASE','baseline',62,'target',100,'postValue',95.907,'weight',100,'dataSource','Reference dataset'))
);
create temporary table p6_final as select public.generate_impact_report_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',(select id from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1),'FINAL') as id;
select public._assert(abs((select htvi_score from public.impact_reports where id=(select id from p6_final))-96.663)<0.002,'HTVI final reproduces 96.7 rounded to one decimal');
select public._assert((select overall_rating from public.impact_reports where id=(select id from p6_final))='EXCELLENT','HTVI rating threshold applied');
select public._assert((select internal_state from public.activities where organization_id='90000000-0000-0000-0000-000000000010' and title_ar='نشاط اللجنة' limit 1)='FINAL_IMPACT_REPORT','final report advances internal workflow');

reset role;
