-- Phase 5: manual external SCFHS tracking. External status is strictly separate from internal committee decision.

insert into public.permissions(code,description) values
  ('external.manage','Record authorized manual external submission and decision tracking'),
  ('external.view','View external submission tracking')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('ORGANIZATION_SYSTEM_ADMIN','ACTIVITY_OFFICER') and p.code='external.manage'
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('ORGANIZATION_SYSTEM_ADMIN','ACTIVITY_OFFICER','COMMITTEE_SECRETARY','COMMITTEE_CHAIR','MANAGEMENT_VIEWER','MANAGEMENT_APPROVER','AUDITOR') and p.code='external.view'
on conflict do nothing;

create table public.external_submission_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  request_number text,
  submission_date date,
  service_type text,
  status text not null default 'READY_FOR_SCFHS_SUBMISSION' check(status in ('READY_FOR_SCFHS_SUBMISSION','SUBMITTED','UNDER_REVIEW','RETURNED','APPROVED','REJECTED')),
  return_notes text,
  accreditation_number text,
  approved_hours numeric(8,2),
  decision_date date,
  evidence_reference text,
  entered_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(activity_id),
  unique(id,organization_id),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade,
  check(approved_hours is null or approved_hours >= 0),
  check(status <> 'APPROVED' or (decision_date is not null and nullif(trim(coalesce(evidence_reference,'')),'') is not null))
);
create trigger external_submission_records_updated before update on public.external_submission_records for each row execute function public.set_updated_at();

create table public.external_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_submission_id uuid not null,
  from_status text,
  to_status text not null,
  notes text,
  changed_by uuid not null references public.users(id),
  role_context text not null,
  changed_at timestamptz not null default now(),
  foreign key(external_submission_id,organization_id) references public.external_submission_records(id,organization_id) on delete cascade
);

alter table public.external_submission_records enable row level security;
alter table public.external_status_history enable row level security;
create policy external_submission_read on public.external_submission_records for select to authenticated
using(public.is_org_member(organization_id) and public.current_role_has_permission(organization_id,coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role_context','ORGANIZATION_SYSTEM_ADMIN'),'external.view') or public.is_org_member(organization_id));
create policy external_history_read on public.external_status_history for select to authenticated using(public.is_org_member(organization_id));
grant select on public.external_submission_records,public.external_status_history to authenticated;

create or replace function public.record_external_status_command(
  p_organization_id uuid,
  p_role_context text,
  p_activity_id uuid,
  p_status text,
  p_request_number text default null,
  p_submission_date date default null,
  p_service_type text default null,
  p_return_notes text default null,
  p_accreditation_number text default null,
  p_approved_hours numeric default null,
  p_decision_date date default null,
  p_evidence_reference text default null
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid(); v_record uuid; v_old text; v_state text; v_decision text;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'external.manage') then
    raise exception using errcode='42501',message='Active role context cannot manage external tracking.';
  end if;
  if p_status not in ('READY_FOR_SCFHS_SUBMISSION','SUBMITTED','UNDER_REVIEW','RETURNED','APPROVED','REJECTED') then
    raise exception using errcode='22023',message='Invalid external status.';
  end if;
  if p_role_context='ACTIVITY_OFFICER' and not public.current_user_is_assigned_activity(p_activity_id) then
    raise exception using errcode='42501',message='Activity Officer is not assigned to this activity.';
  end if;
  select a.internal_state into v_state from public.activities a where a.id=p_activity_id and a.organization_id=p_organization_id for update;
  if v_state is null then raise exception using errcode='22023',message='Activity not found.'; end if;
  select d.decision into v_decision from public.committee_decisions d where d.activity_id=p_activity_id and d.organization_id=p_organization_id order by d.decided_at desc limit 1;
  if v_decision is distinct from 'APPROVED_FOR_SCFHS_SUBMISSION' then
    raise exception using errcode='22023',message='External tracking requires Chair-approved readiness for submission.';
  end if;
  if p_status in ('SUBMITTED','UNDER_REVIEW','RETURNED','APPROVED','REJECTED') and nullif(trim(coalesce(p_request_number,'')),'') is null then
    raise exception using errcode='22023',message='External request number is required after submission.';
  end if;
  if p_status='APPROVED' and (p_decision_date is null or nullif(trim(coalesce(p_evidence_reference,'')),'') is null) then
    raise exception using errcode='22023',message='External approval requires decision date and evidence reference.';
  end if;

  select id,status into v_record,v_old from public.external_submission_records where activity_id=p_activity_id and organization_id=p_organization_id for update;
  if v_record is null then
    insert into public.external_submission_records(
      organization_id,activity_id,request_number,submission_date,service_type,status,return_notes,accreditation_number,approved_hours,decision_date,evidence_reference,entered_by
    ) values(
      p_organization_id,p_activity_id,nullif(trim(p_request_number),''),p_submission_date,nullif(trim(p_service_type),''),p_status,
      nullif(trim(p_return_notes),''),nullif(trim(p_accreditation_number),''),p_approved_hours,p_decision_date,nullif(trim(p_evidence_reference),''),v_actor
    ) returning id into v_record;
  else
    update public.external_submission_records set
      request_number=coalesce(nullif(trim(p_request_number),''),request_number),submission_date=coalesce(p_submission_date,submission_date),
      service_type=coalesce(nullif(trim(p_service_type),''),service_type),status=p_status,return_notes=nullif(trim(p_return_notes),''),
      accreditation_number=coalesce(nullif(trim(p_accreditation_number),''),accreditation_number),approved_hours=coalesce(p_approved_hours,approved_hours),
      decision_date=coalesce(p_decision_date,decision_date),evidence_reference=coalesce(nullif(trim(p_evidence_reference),''),evidence_reference),entered_by=v_actor
    where id=v_record;
  end if;
  insert into public.external_status_history(organization_id,external_submission_id,from_status,to_status,notes,changed_by,role_context)
  values(p_organization_id,v_record,v_old,p_status,p_return_notes,v_actor,p_role_context);

  if p_status='READY_FOR_SCFHS_SUBMISSION' and v_state='APPROVED_FOR_SCFHS_SUBMISSION' then
    update public.activities set internal_state='READY_FOR_SCFHS_SUBMISSION' where id=p_activity_id;
    insert into public.activity_status_history(organization_id,activity_id,from_state,to_state,changed_by,role_context,reason)
    values(p_organization_id,p_activity_id,v_state,'READY_FOR_SCFHS_SUBMISSION',v_actor,p_role_context,'Prepared for external submission');
  elsif p_status in ('SUBMITTED','UNDER_REVIEW','RETURNED','APPROVED','REJECTED') and v_state in ('APPROVED_FOR_SCFHS_SUBMISSION','READY_FOR_SCFHS_SUBMISSION') then
    update public.activities set internal_state='EXTERNAL_TRACKING' where id=p_activity_id;
    insert into public.activity_status_history(organization_id,activity_id,from_state,to_state,changed_by,role_context,reason)
    values(p_organization_id,p_activity_id,v_state,'EXTERNAL_TRACKING',v_actor,p_role_context,'External status recorded: '||p_status);
  end if;

  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'external.status_recorded','activity',p_activity_id,
    jsonb_build_object('status',v_old),jsonb_build_object('status',p_status,'request_number',p_request_number,'evidence_reference',p_evidence_reference),null,null,null);
  return v_record;
end;
$$;
revoke all on function public.record_external_status_command(uuid,text,uuid,text,text,date,text,text,text,numeric,date,text) from public;
grant execute on function public.record_external_status_command(uuid,text,uuid,text,text,date,text,text,text,numeric,date,text) to authenticated;
