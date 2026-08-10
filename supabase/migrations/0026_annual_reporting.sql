-- Phase 7: internal annual scientific committee report, Chair approval then management acknowledgement.

insert into public.permissions(code,description) values
  ('annual.generate','Generate and validate annual committee report draft'),
  ('annual.view','View annual committee reports')
on conflict(code) do update set description=excluded.description;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('ORGANIZATION_SYSTEM_ADMIN','COMMITTEE_SECRETARY') and p.code='annual.generate' on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('ORGANIZATION_SYSTEM_ADMIN','COMMITTEE_SECRETARY','COMMITTEE_CHAIR','MANAGEMENT_VIEWER','MANAGEMENT_APPROVER','AUDITOR') and p.code='annual.view' on conflict do nothing;

create table public.annual_committee_reports (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  reporting_year integer not null check(reporting_year between 2000 and 2200),
  status text not null default 'DRAFT' check(status in ('DRAFT','DATA_VALIDATION','CHAIR_REVIEW','CHAIR_APPROVED','SUBMITTED_TO_MANAGEMENT','ACKNOWLEDGED','ARCHIVED')),
  snapshot_json jsonb, snapshot_sha256 text, generated_by uuid not null references public.users(id), generated_at timestamptz not null default now(),
  chair_approved_by uuid references public.users(id), chair_approved_at timestamptz,
  submitted_to_management_at timestamptz, updated_at timestamptz not null default now(),
  unique(organization_id,reporting_year), unique(id,organization_id)
);
create trigger annual_reports_updated before update on public.annual_committee_reports for each row execute function public.set_updated_at();

create table public.annual_report_metrics (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  annual_report_id uuid not null, metric_code text not null, metric_value numeric, metric_text text, denominator numeric,
  created_at timestamptz not null default now(), unique(annual_report_id,metric_code),
  foreign key(annual_report_id,organization_id) references public.annual_committee_reports(id,organization_id) on delete cascade
);

create table public.member_contribution_metrics (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  annual_report_id uuid not null, committee_member_id uuid not null, full_name_snapshot text not null, committee_role text not null,
  appointment_from date not null, appointment_to date, eligible_meetings integer not null default 0, attended_meetings integer not null default 0,
  absent_meetings integer not null default 0, excused_meetings integer not null default 0, attendance_rate numeric(7,3),
  activities_reviewed integer not null default 0, contribution_statement text,
  unique(annual_report_id,committee_member_id),
  foreign key(annual_report_id,organization_id) references public.annual_committee_reports(id,organization_id) on delete cascade,
  foreign key(committee_member_id,organization_id) references public.institutional_committee_members(id,organization_id)
);

create table public.annual_report_acknowledgements (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  annual_report_id uuid not null, acknowledged_by uuid not null references public.users(id), management_comment text,
  acknowledged_at timestamptz not null default now(), unique(annual_report_id),
  foreign key(annual_report_id,organization_id) references public.annual_committee_reports(id,organization_id) on delete cascade
);

create or replace function public.protect_chair_approved_annual_snapshot() returns trigger language plpgsql as $$
begin
  if old.status in ('CHAIR_APPROVED','SUBMITTED_TO_MANAGEMENT','ACKNOWLEDGED','ARCHIVED') and (new.snapshot_json is distinct from old.snapshot_json or new.snapshot_sha256 is distinct from old.snapshot_sha256 or new.reporting_year is distinct from old.reporting_year) then
    raise exception 'Chair-approved annual report snapshot is immutable';
  end if;
  return new;
end $$;
create trigger annual_report_snapshot_guard before update on public.annual_committee_reports for each row execute function public.protect_chair_approved_annual_snapshot();

alter table public.annual_committee_reports enable row level security;
alter table public.annual_report_metrics enable row level security;
alter table public.member_contribution_metrics enable row level security;
alter table public.annual_report_acknowledgements enable row level security;
create policy annual_reports_read on public.annual_committee_reports for select to authenticated using(public.is_org_member(organization_id));
create policy annual_metrics_read on public.annual_report_metrics for select to authenticated using(public.is_org_member(organization_id));
create policy member_contrib_read on public.member_contribution_metrics for select to authenticated using(public.is_org_member(organization_id));
create policy annual_ack_read on public.annual_report_acknowledgements for select to authenticated using(public.is_org_member(organization_id));
grant select on public.annual_committee_reports,public.annual_report_metrics,public.member_contribution_metrics,public.annual_report_acknowledgements to authenticated;

create or replace function public.generate_annual_committee_report_command(p_organization_id uuid,p_role_context text,p_year integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=auth.uid(); v_report uuid; v_total int; v_approved int; v_returned int; v_not_approved int; v_final int; v_eligible int; v_avg numeric; v_snapshot jsonb; v_hash text; v_member record; v_eligible_meetings int; v_present int; v_absent int; v_excused int;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'annual.generate') then raise exception using errcode='42501',message='Not authorized to generate annual report'; end if;
  select count(*) into v_total from public.activities where organization_id=p_organization_id and reporting_year=p_year;
  select count(*) filter(where decision='APPROVED_FOR_SCFHS_SUBMISSION'),count(*) filter(where decision='RETURNED_FOR_CORRECTION'),count(*) filter(where decision='NOT_APPROVED')
  into v_approved,v_returned,v_not_approved from public.committee_decisions d join public.activities a on a.id=d.activity_id where d.organization_id=p_organization_id and a.reporting_year=p_year;
  select count(distinct a.id) into v_eligible from public.activities a where a.organization_id=p_organization_id and a.reporting_year=p_year and a.internal_state in ('IMPACT_FOLLOWUP','FINAL_IMPACT_REPORT','ANNUAL_REPORTING','ARCHIVED');
  select count(*),avg(r.htvi_score) into v_final,v_avg from public.impact_reports r join public.activities a on a.id=r.activity_id where r.organization_id=p_organization_id and a.reporting_year=p_year and r.kind='FINAL' and r.status='FINAL';

  insert into public.annual_committee_reports(organization_id,reporting_year,status,generated_by) values(p_organization_id,p_year,'DATA_VALIDATION',v_actor)
  on conflict(organization_id,reporting_year) do update set status='DATA_VALIDATION',generated_by=v_actor,generated_at=now(),snapshot_json=null,snapshot_sha256=null,chair_approved_by=null,chair_approved_at=null,submitted_to_management_at=null
  returning id into v_report;
  delete from public.annual_report_metrics where annual_report_id=v_report;
  delete from public.member_contribution_metrics where annual_report_id=v_report;
  delete from public.annual_report_acknowledgements where annual_report_id=v_report;

  insert into public.annual_report_metrics(organization_id,annual_report_id,metric_code,metric_value,denominator) values
    (p_organization_id,v_report,'ACTIVITIES_TOTAL',v_total,null),
    (p_organization_id,v_report,'COMMITTEE_APPROVED',v_approved,null),
    (p_organization_id,v_report,'COMMITTEE_RETURNED',v_returned,null),
    (p_organization_id,v_report,'COMMITTEE_NOT_APPROVED',v_not_approved,null),
    (p_organization_id,v_report,'FINAL_IMPACT_REPORTS',v_final,v_eligible),
    (p_organization_id,v_report,'FINAL_HTVI_AVERAGE',v_avg,v_eligible),
    (p_organization_id,v_report,'HTVI_COVERAGE_PERCENT',case when v_eligible=0 then null else round(v_final::numeric/v_eligible*100,3) end,v_eligible);

  for v_member in
    select m.* from public.institutional_committee_members m join public.institutional_committees c on c.id=m.committee_id
    where m.organization_id=p_organization_id and daterange(m.appointment_from,coalesce(m.appointment_to,'9999-12-31'::date),'[]') && daterange(make_date(p_year,1,1),make_date(p_year,12,31),'[]')
  loop
    select count(*) into v_eligible_meetings from public.committee_meetings mt where mt.organization_id=p_organization_id and mt.committee_id=v_member.committee_id and mt.status in ('HELD','CLOSED') and mt.scheduled_at::date between greatest(v_member.appointment_from,make_date(p_year,1,1)) and least(coalesce(v_member.appointment_to,make_date(p_year,12,31)),make_date(p_year,12,31));
    select count(*) filter(where ma.attendance_status='PRESENT'),count(*) filter(where ma.attendance_status='ABSENT'),count(*) filter(where ma.attendance_status='EXCUSED')
      into v_present,v_absent,v_excused from public.meeting_attendance ma join public.committee_meetings mt on mt.id=ma.meeting_id where ma.organization_id=p_organization_id and ma.committee_member_id=v_member.id and extract(year from mt.scheduled_at)=p_year;
    insert into public.member_contribution_metrics(organization_id,annual_report_id,committee_member_id,full_name_snapshot,committee_role,appointment_from,appointment_to,eligible_meetings,attended_meetings,absent_meetings,excused_meetings,attendance_rate,activities_reviewed,contribution_statement)
    values(p_organization_id,v_report,v_member.id,v_member.full_name_snapshot,v_member.committee_role,v_member.appointment_from,v_member.appointment_to,v_eligible_meetings,coalesce(v_present,0),coalesce(v_absent,0),coalesce(v_excused,0),case when v_eligible_meetings=0 then null else round(coalesce(v_present,0)::numeric/v_eligible_meetings*100,3) end,0,'Verified participation data only; no financial reward decision is calculated.');
  end loop;

  v_snapshot:=jsonb_build_object('reporting_year',p_year,'metrics',(select jsonb_agg(to_jsonb(m) order by m.metric_code) from public.annual_report_metrics m where m.annual_report_id=v_report),'member_contributions',(select coalesce(jsonb_agg(to_jsonb(c) order by c.committee_role,c.full_name_snapshot),'[]'::jsonb) from public.member_contribution_metrics c where c.annual_report_id=v_report));
  v_hash:=encode(digest(v_snapshot::text,'sha256'),'hex');
  update public.annual_committee_reports set snapshot_json=v_snapshot,snapshot_sha256=v_hash,status='CHAIR_REVIEW' where id=v_report;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'annual.report_generated','annual_committee_report',v_report,null,jsonb_build_object('year',p_year,'snapshot_sha256',v_hash),null,null,null);
  return v_report;
end $$;
revoke all on function public.generate_annual_committee_report_command(uuid,text,integer) from public;
grant execute on function public.generate_annual_committee_report_command(uuid,text,integer) to authenticated;

create or replace function public.approve_annual_committee_report_command(p_organization_id uuid,p_role_context text,p_report_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_committee uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'annual.approve_committee') then raise exception using errcode='42501',message='Only Committee Chair can approve annual committee report'; end if;
  select id into v_committee from public.institutional_committees where organization_id=p_organization_id and status='ACTIVE' limit 1;
  if not exists(select 1 from public.institutional_committee_members where committee_id=v_committee and user_id=v_actor and committee_role='CHAIR' and status='ACTIVE') then raise exception using errcode='42501',message='User is not active Committee Chair'; end if;
  update public.annual_committee_reports set status='CHAIR_APPROVED',chair_approved_by=v_actor,chair_approved_at=now() where id=p_report_id and organization_id=p_organization_id and status='CHAIR_REVIEW';
  if not found then raise exception using errcode='22023',message='Annual report is not ready for Chair approval'; end if;
  update public.annual_committee_reports set status='SUBMITTED_TO_MANAGEMENT',submitted_to_management_at=now() where id=p_report_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'annual.report_chair_approved','annual_committee_report',p_report_id,null,null,null,null,null);
end $$;
revoke all on function public.approve_annual_committee_report_command(uuid,text,uuid) from public;
grant execute on function public.approve_annual_committee_report_command(uuid,text,uuid) to authenticated;

create or replace function public.acknowledge_annual_committee_report_command(p_organization_id uuid,p_role_context text,p_report_id uuid,p_comment text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'annual.acknowledge') then raise exception using errcode='42501',message='Management acknowledgement is required'; end if;
  if not exists(select 1 from public.annual_committee_reports where id=p_report_id and organization_id=p_organization_id and status='SUBMITTED_TO_MANAGEMENT') then raise exception using errcode='22023',message='Annual report has not been submitted to management'; end if;
  insert into public.annual_report_acknowledgements(organization_id,annual_report_id,acknowledged_by,management_comment) values(p_organization_id,p_report_id,v_actor,nullif(trim(p_comment),''));
  update public.annual_committee_reports set status='ACKNOWLEDGED' where id=p_report_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'annual.report_acknowledged','annual_committee_report',p_report_id,null,jsonb_build_object('management_comment',p_comment),null,null,null);
end $$;
revoke all on function public.acknowledge_annual_committee_report_command(uuid,text,uuid,text) from public;
grant execute on function public.acknowledge_annual_committee_report_command(uuid,text,uuid,text) to authenticated;
