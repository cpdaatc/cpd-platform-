-- Extraction fallback governance. Native extraction quality may require manual verification or an approved OCR/vision provider.

alter table public.extraction_runs
  add column if not exists requires_fallback boolean not null default false,
  add column if not exists fallback_reason text,
  add column if not exists suggested_fallback_engine text check(suggested_fallback_engine is null or suggested_fallback_engine in ('OCR','VISION','MANUAL')),
  add column if not exists fallback_status text not null default 'NOT_REQUIRED' check(fallback_status in ('NOT_REQUIRED','PENDING','RESOLVED_MANUAL','RESOLVED_PROVIDER'));

create or replace function public.mark_extraction_fallback_required_command(
  p_organization_id uuid,p_role_context text,p_extraction_run_id uuid,p_reason text,p_suggested_engine text default 'MANUAL'
)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_activity uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'activity.fill_submit') then raise exception using errcode='42501',message='Not authorized'; end if;
  if p_suggested_engine not in ('OCR','VISION','MANUAL') then raise exception using errcode='22023',message='Invalid fallback engine'; end if;
  select activity_id into v_activity from public.extraction_runs where id=p_extraction_run_id and organization_id=p_organization_id;
  if v_activity is null or not (public.current_role_has_permission(p_organization_id,p_role_context,'activity.view.all') or public.current_user_is_assigned_activity(v_activity)) then raise exception using errcode='42501',message='Extraction run is not available'; end if;
  update public.extraction_runs set requires_fallback=true,fallback_reason=nullif(trim(p_reason),''),suggested_fallback_engine=p_suggested_engine,fallback_status='PENDING' where id=p_extraction_run_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'activity.pdf_extraction_fallback_required','extraction_run',p_extraction_run_id,null,jsonb_build_object('activity_id',v_activity,'reason',p_reason,'suggested_engine',p_suggested_engine),null,null,null);
end $$;
revoke all on function public.mark_extraction_fallback_required_command(uuid,text,uuid,text,text) from public;
grant execute on function public.mark_extraction_fallback_required_command(uuid,text,uuid,text,text) to authenticated;

create or replace function public.resolve_extraction_fallback_manual_command(p_organization_id uuid,p_role_context text,p_extraction_run_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_activity uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'activity.fill_submit') then raise exception using errcode='42501',message='Not authorized'; end if;
  select activity_id into v_activity from public.extraction_runs where id=p_extraction_run_id and organization_id=p_organization_id and fallback_status='PENDING';
  if v_activity is null or not (public.current_role_has_permission(p_organization_id,p_role_context,'activity.view.all') or public.current_user_is_assigned_activity(v_activity)) then raise exception using errcode='42501',message='Pending extraction fallback not available'; end if;
  update public.extraction_runs set fallback_status='RESOLVED_MANUAL' where id=p_extraction_run_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'activity.pdf_extraction_fallback_resolved_manual','extraction_run',p_extraction_run_id,null,jsonb_build_object('activity_id',v_activity),null,null,null);
end $$;
revoke all on function public.resolve_extraction_fallback_manual_command(uuid,text,uuid) from public;
grant execute on function public.resolve_extraction_fallback_manual_command(uuid,text,uuid) to authenticated;
