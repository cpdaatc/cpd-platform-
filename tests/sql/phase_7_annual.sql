\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000903',false);
create temporary table p7_report as select public.generate_annual_committee_report_command('90000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY',2026) as id;
select public._assert((select status from public.annual_committee_reports where id=(select id from p7_report))='CHAIR_REVIEW','annual report is generated for Chair review');
select public._assert(abs((select metric_value from public.annual_report_metrics where annual_report_id=(select id from p7_report) and metric_code='FINAL_HTVI_AVERAGE')-96.663)<0.002,'annual HTVI average uses final HTVI only');
select public._assert((select denominator from public.annual_report_metrics where annual_report_id=(select id from p7_report) and metric_code='FINAL_HTVI_AVERAGE')=1,'annual HTVI exposes coverage denominator');
select public._assert((select count(*) from public.member_contribution_metrics where annual_report_id=(select id from p7_report))>=3,'committee member contribution records are generated');
select public._assert((select max(eligible_meetings) from public.member_contribution_metrics where annual_report_id=(select id from p7_report))>=1,'member denominator uses actual eligible meetings');

do $$
begin
  begin
    perform public.approve_annual_committee_report_command('90000000-0000-0000-0000-000000000010','COMMITTEE_SECRETARY',(select id from p7_report));
    raise exception 'secretary unexpectedly approved annual report';
  exception when others then
    if sqlerrm='secretary unexpectedly approved annual report' then raise; end if;
    if sqlstate<>'42501' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000904',false);
select public.approve_annual_committee_report_command('90000000-0000-0000-0000-000000000010','COMMITTEE_CHAIR',(select id from p7_report));
select public._assert((select status from public.annual_committee_reports where id=(select id from p7_report))='SUBMITTED_TO_MANAGEMENT','Chair approval submits report to management without transferring scientific authority');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000906',false);
select public.acknowledge_annual_committee_report_command('90000000-0000-0000-0000-000000000010','MANAGEMENT_APPROVER',(select id from p7_report),'Received for annual administration reporting');
select public._assert((select status from public.annual_committee_reports where id=(select id from p7_report))='ACKNOWLEDGED','management acknowledgement closes annual handoff');
select public._assert((select count(*) from public.annual_report_acknowledgements where annual_report_id=(select id from p7_report))=1,'management acknowledgement is separately recorded');

reset role;
