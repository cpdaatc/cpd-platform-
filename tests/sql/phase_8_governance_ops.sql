\set ON_ERROR_STOP on

-- Build one synthetic overdue follow-up event for notification testing.
insert into public.activities(id,organization_id,activity_code,title_ar,reporting_year,internal_state,created_by)
values('98000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000010','HT-P8-001','نشاط تنبيه تجريبي',2026,'IMPACT_FOLLOWUP','00000000-0000-0000-0000-000000000901')
on conflict(id) do nothing;
insert into public.activity_assignments(organization_id,activity_id,membership_id,assigned_by,is_active)
values('90000000-0000-0000-0000-000000000010','98000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000901',true)
on conflict(activity_id,membership_id,assignment_role) do update set is_active=true;
insert into public.activity_impact_schedules(organization_id,activity_id,policy_id,level,due_at,grace_until,required,status)
select '90000000-0000-0000-0000-000000000010','98000000-0000-0000-0000-000000000001',id,'L3',now()-interval '20 days',now()-interval '5 days',true,'DUE'
from public.impact_followup_policies where organization_id='90000000-0000-0000-0000-000000000010' and status='ACTIVE'
on conflict(activity_id,level) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
create temporary table p8_template as select public.create_template_version_command(
  '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN','OFFICIAL_ACTIVITY_FORM','OFFICIAL_EXTERNAL_FORM','نموذج النشاط','Activity Form','2026.1','Official source reference','templates/activity/2026.1.pdf',repeat('a',64),
  jsonb_build_array(jsonb_build_object('field','titleAr','page',1,'x',100,'y',120))) as id;
select public.mark_template_qa_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',(select id from p8_template),'PASSED','PASSED');

do $$
begin
  begin
    perform public.activate_template_version_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',(select id from p8_template),current_date);
    raise exception 'system admin unexpectedly activated template';
  exception when others then
    if sqlerrm='system admin unexpectedly activated template' then raise; end if;
    if sqlstate<>'42501' then raise; end if;
  end;
end $$;

select public._assert(public.refresh_governance_notifications_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN')>=1,'notification refresh creates in-app due/overdue notification');
select public._assert(exists(select 1 from public.activity_evidence_readiness where activity_id=(select id from public.activities where title_ar='نشاط اللجنة' limit 1) and final_impact_report_available=true),'evidence readiness reflects final impact output');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000906',false);
select public.activate_template_version_command('90000000-0000-0000-0000-000000000010','MANAGEMENT_APPROVER',(select id from p8_template),current_date);
select public._assert((select status from public.template_versions where id=(select id from p8_template))='ACTIVE','QA-passed template is activated only by management approver');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000902',false);
select public._assert(exists(select 1 from public.notifications where recipient_user_id='00000000-0000-0000-0000-000000000902' and event_code='IMPACT_OVERDUE'),'assigned Activity Officer receives overdue in-app notification');

reset role;
