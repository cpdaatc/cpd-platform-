-- Controlled correction workflow for finalized impact reports.
-- Historical final snapshots remain immutable; approved correction supersedes the current final report before inputs can be edited.

insert into public.permissions(code,description) values
  ('impact.correction.request','Request correction of a finalized impact report'),
  ('impact.correction.approve','Approve a controlled impact report correction')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('ORGANIZATION_SYSTEM_ADMIN','ACTIVITY_OFFICER') and p.code='impact.correction.request'
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='MANAGEMENT_APPROVER' and p.code='impact.correction.approve'
on conflict do nothing;

-- Replace the original check so historical FINAL report versions may be SUPERSEDED without losing their frozen HTVI snapshot.
do $$
declare v_name text;
begin
  select conname into v_name
  from pg_constraint
  where conrelid='public.impact_reports'::regclass and contype='c'
    and pg_get_constraintdef(oid) ilike '%kind%FINAL%htvi_status%FINAL%htvi_score%';
  if v_name is not null then execute format('alter table public.impact_reports drop constraint %I',v_name); end if;
end $$;

alter table public.impact_reports
  add constraint impact_reports_kind_state_check check(
    (kind='INTERIM' and status='DRAFT' and htvi_status='PENDING')
    or
    (kind='FINAL' and status in ('FINAL','SUPERSEDED') and htvi_status='FINAL' and htvi_score is not null)
  );

create table public.impact_correction_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  final_report_id uuid not null,
  reason text not null,
  status text not null default 'REQUESTED' check(status in ('REQUESTED','APPROVED','REJECTED','APPLIED','CANCELLED')),
  requested_by uuid not null references public.users(id),
  requested_role_context text not null,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  review_note text,
  applied_report_id uuid,
  applied_at timestamptz,
  unique(id,organization_id),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade,
  foreign key(final_report_id,organization_id) references public.impact_reports(id,organization_id),
  foreign key(applied_report_id,organization_id) references public.impact_reports(id,organization_id)
);
create unique index impact_correction_one_open_idx on public.impact_correction_requests(activity_id) where status in ('REQUESTED','APPROVED');

alter table public.impact_correction_requests enable row level security;
create policy impact_corrections_read on public.impact_correction_requests for select to authenticated using(public.is_org_member(organization_id));
grant select on public.impact_correction_requests to authenticated;

create or replace function public.request_impact_correction_command(p_organization_id uuid,p_role_context text,p_activity_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_report uuid;v_id uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'impact.correction.request') then raise exception using errcode='42501',message='Not authorized to request impact correction'; end if;
  if p_role_context='ACTIVITY_OFFICER' and not public.current_user_is_assigned_activity(p_activity_id) then raise exception using errcode='42501',message='Activity Officer is not assigned'; end if;
  if nullif(trim(p_reason),'') is null then raise exception using errcode='22023',message='Correction reason is required'; end if;
  select id into v_report from public.impact_reports where organization_id=p_organization_id and activity_id=p_activity_id and kind='FINAL' and status='FINAL' order by version_no desc limit 1;
  if v_report is null then raise exception using errcode='22023',message='No current finalized impact report exists'; end if;
  insert into public.impact_correction_requests(organization_id,activity_id,final_report_id,reason,requested_by,requested_role_context)
  values(p_organization_id,p_activity_id,v_report,trim(p_reason),v_actor,p_role_context) returning id into v_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'impact.correction_requested','impact_correction_request',v_id,null,jsonb_build_object('activity_id',p_activity_id,'final_report_id',v_report,'reason',trim(p_reason)),null,null,null);
  return v_id;
end $$;
revoke all on function public.request_impact_correction_command(uuid,text,uuid,text) from public;
grant execute on function public.request_impact_correction_command(uuid,text,uuid,text) to authenticated;

create or replace function public.review_impact_correction_command(p_organization_id uuid,p_role_context text,p_request_id uuid,p_decision text,p_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v public.impact_correction_requests%rowtype;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'impact.correction.approve') then raise exception using errcode='42501',message='Management approval is required'; end if;
  if p_decision not in ('APPROVE','REJECT') then raise exception using errcode='22023',message='Decision must be APPROVE or REJECT'; end if;
  select * into v from public.impact_correction_requests where id=p_request_id and organization_id=p_organization_id for update;
  if v.id is null or v.status<>'REQUESTED' then raise exception using errcode='22023',message='Pending correction request not found'; end if;
  if p_decision='REJECT' then
    update public.impact_correction_requests set status='REJECTED',reviewed_by=v_actor,reviewed_at=now(),review_note=nullif(trim(p_note),'') where id=v.id;
  else
    -- This status-only change preserves the immutable snapshot and opens a controlled new measurement version.
    update public.impact_reports set status='SUPERSEDED' where id=v.final_report_id and organization_id=p_organization_id and status='FINAL';
    if not found then raise exception using errcode='22023',message='Current final impact report is no longer available'; end if;
    update public.impact_correction_requests set status='APPROVED',reviewed_by=v_actor,reviewed_at=now(),review_note=nullif(trim(p_note),'') where id=v.id;
    update public.activities set internal_state='IMPACT_FOLLOWUP' where id=v.activity_id and organization_id=p_organization_id;
    insert into public.activity_status_history(organization_id,activity_id,from_state,to_state,changed_by,role_context,reason)
    values(p_organization_id,v.activity_id,'FINAL_IMPACT_REPORT','IMPACT_FOLLOWUP',v_actor,p_role_context,'Approved correction request reopens impact follow-up while preserving prior final report snapshot');
  end if;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'impact.correction_reviewed','impact_correction_request',v.id,jsonb_build_object('status','REQUESTED'),jsonb_build_object('decision',p_decision,'note',p_note),null,null,null);
end $$;
revoke all on function public.review_impact_correction_command(uuid,text,uuid,text,text) from public;
grant execute on function public.review_impact_correction_command(uuid,text,uuid,text,text) to authenticated;

create or replace function public.mark_impact_correction_applied() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.kind='FINAL' and new.status='FINAL' then
    update public.impact_correction_requests set status='APPLIED',applied_report_id=new.id,applied_at=now()
    where organization_id=new.organization_id and activity_id=new.activity_id and status='APPROVED';
  end if;
  return new;
end $$;
create trigger impact_correction_applied_after_final after insert on public.impact_reports for each row execute function public.mark_impact_correction_applied();
