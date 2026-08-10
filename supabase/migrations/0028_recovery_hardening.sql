-- Recovery hardening after Phases 5-8.

-- Internal helper only; tenant UI must use governed commands that validate role/assignment.
revoke execute on function public.refresh_impact_schedule_statuses(uuid,uuid) from authenticated;

-- A finalized impact report freezes its measurement inputs. A future correction flow must supersede the final report first.
create or replace function public.protect_finalized_impact_inputs() returns trigger language plpgsql as $$
declare v_activity uuid;
begin
  v_activity:=case when tg_op='DELETE' then old.activity_id else new.activity_id end;
  if exists(select 1 from public.impact_reports r where r.activity_id=v_activity and r.kind='FINAL' and r.status='FINAL') then
    raise exception 'Impact inputs are frozen after final report; use controlled correction/versioning workflow';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger impact_level_inputs_guard before insert or update or delete on public.impact_level_results for each row execute function public.protect_finalized_impact_inputs();
create trigger impact_objective_inputs_guard before insert or update or delete on public.impact_objectives for each row execute function public.protect_finalized_impact_inputs();

-- External status has its own state machine and cannot be silently jumped to an external approval.
create or replace function public.validate_external_status_transition() returns trigger language plpgsql as $$
begin
  if tg_op='INSERT' then
    if new.status not in ('READY_FOR_SCFHS_SUBMISSION','SUBMITTED') then raise exception 'Initial external status must be READY_FOR_SCFHS_SUBMISSION or SUBMITTED'; end if;
    return new;
  end if;
  if new.status=old.status then return new; end if;
  if old.status='READY_FOR_SCFHS_SUBMISSION' and new.status not in ('SUBMITTED') then raise exception 'Invalid external status transition'; end if;
  if old.status='SUBMITTED' and new.status not in ('UNDER_REVIEW','RETURNED','APPROVED','REJECTED') then raise exception 'Invalid external status transition'; end if;
  if old.status='UNDER_REVIEW' and new.status not in ('RETURNED','APPROVED','REJECTED') then raise exception 'Invalid external status transition'; end if;
  if old.status='RETURNED' and new.status not in ('SUBMITTED') then raise exception 'Returned external request must be resubmitted'; end if;
  if old.status='REJECTED' and new.status not in ('SUBMITTED') then raise exception 'Rejected external request requires explicit resubmission'; end if;
  if old.status='APPROVED' then raise exception 'External approved status is final; corrections require evidence/version workflow'; end if;
  return new;
end $$;
create trigger external_status_transition_guard before insert or update of status on public.external_submission_records for each row execute function public.validate_external_status_transition();

-- Mark notifications read through a governed command; no generic UPDATE policy is exposed.
create or replace function public.mark_notification_read_command(p_organization_id uuid,p_role_context text,p_notification_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'notification.view') then raise exception using errcode='42501',message='Not authorized'; end if;
  update public.notifications set is_read=true,read_at=now() where id=p_notification_id and organization_id=p_organization_id and recipient_user_id=v_actor;
  if not found then raise exception using errcode='42501',message='Notification is not owned by current user'; end if;
end $$;
revoke all on function public.mark_notification_read_command(uuid,text,uuid) from public;
grant execute on function public.mark_notification_read_command(uuid,text,uuid) to authenticated;

-- Explicit tenant read boundary for external tracking. Application pages still enforce active role permission.
drop policy if exists external_submission_read on public.external_submission_records;
create policy external_submission_read on public.external_submission_records for select to authenticated using(public.is_org_member(organization_id));

-- Every final report snapshot must preserve exactly the methodology used; no historical recalculation is performed.
create index if not exists impact_reports_final_lookup_idx on public.impact_reports(organization_id,activity_id,generated_at desc) where kind='FINAL';
create index if not exists annual_reports_year_idx on public.annual_committee_reports(organization_id,reporting_year desc);
