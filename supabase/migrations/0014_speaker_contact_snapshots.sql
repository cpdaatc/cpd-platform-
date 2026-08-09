-- Preserve the speaker contact fields present in the supplied activity form as activity-specific snapshots.
alter table public.activity_speakers
  add column if not exists mobile_snapshot text,
  add column if not exists email_snapshot text,
  add column if not exists scfhs_registration_number_snapshot text;

create or replace function public.save_activity_speaker_contact_command(
  p_organization_id uuid,
  p_role_context text,
  p_activity_speaker_id uuid,
  p_mobile text,
  p_email text,
  p_scfhs_registration_number text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor uuid:=auth.uid();
  v_activity_id uuid;
begin
  select activity_id into v_activity_id
  from public.activity_speakers
  where id=p_activity_speaker_id and organization_id=p_organization_id;

  if v_activity_id is null then raise exception 'Activity speaker not found'; end if;
  if not public.current_role_has_permission(p_organization_id,p_role_context,'activity.fill_submit')
     or not (public.current_role_has_permission(p_organization_id,p_role_context,'activity.view.all') or public.current_user_is_assigned_activity(v_activity_id)) then
    raise exception using errcode='42501', message='Active role context cannot edit speaker contact snapshot.';
  end if;

  update public.activity_speakers
  set mobile_snapshot=nullif(trim(p_mobile),''),
      email_snapshot=nullif(trim(p_email),''),
      scfhs_registration_number_snapshot=nullif(trim(p_scfhs_registration_number),'')
  where id=p_activity_speaker_id;

  perform public.log_audit_event(
    p_organization_id,v_actor,p_role_context,'activity.speaker_contact_snapshot_updated','activity',v_activity_id,null,
    jsonb_build_object('activity_speaker_id',p_activity_speaker_id,'has_mobile',nullif(trim(p_mobile),'') is not null,'has_email',nullif(trim(p_email),'') is not null),
    null,null,null
  );
end;
$$;
revoke all on function public.save_activity_speaker_contact_command(uuid,text,uuid,text,text,text) from public;
grant execute on function public.save_activity_speaker_contact_command(uuid,text,uuid,text,text,text) to authenticated;
