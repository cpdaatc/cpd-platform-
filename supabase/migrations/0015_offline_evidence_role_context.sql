-- Canonical governance correction: System Admin alone must not certify/record offline evidence.
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id=r.id
  and rp.permission_id=p.id
  and r.code='ORGANIZATION_SYSTEM_ADMIN'
  and p.code='evidence.record_offline';

revoke all on function public.record_offline_evidence_review(uuid,uuid,timestamptz,text,boolean,text) from authenticated;
drop function public.record_offline_evidence_review(uuid,uuid,timestamptz,text,boolean,text);

create or replace function public.record_offline_evidence_review(
  p_evidence_id uuid,
  p_role_context text,
  p_verified_by uuid,
  p_verified_at timestamptz,
  p_evidence_location text,
  p_original_exists_confirmed boolean,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid;
  v_review_id uuid;
  v_actor uuid:=auth.uid();
begin
  select organization_id into v_org from public.activity_evidence where id=p_evidence_id;
  if v_org is null then raise exception 'Evidence not found'; end if;

  if v_actor is null or not public.current_role_has_permission(v_org,p_role_context,'evidence.record_offline') then
    raise exception using errcode='42501', message='Active role context cannot record offline evidence';
  end if;
  if not public.user_has_permission_in_org(p_verified_by,v_org,'evidence.verify_offline') then
    raise exception using errcode='42501', message='Verifier is not authorized';
  end if;
  if p_verified_at is null or nullif(trim(p_evidence_location),'') is null or p_original_exists_confirmed is not true then
    raise exception using errcode='22023', message='Offline review requires verifier, date, location, and confirmation that the original existed';
  end if;

  update public.activity_evidence set status='OFFLINE_REVIEWED', updated_at=now() where id=p_evidence_id;
  insert into public.evidence_reviews(
    organization_id,evidence_id,review_status,recorded_by,verified_by,verified_at,evidence_location,original_exists_confirmed,reason
  ) values(
    v_org,p_evidence_id,'OFFLINE_REVIEWED',v_actor,p_verified_by,p_verified_at,p_evidence_location,true,p_reason
  ) returning id into v_review_id;

  perform public.log_audit_event(
    v_org,v_actor,p_role_context,'activity.evidence_offline_review_recorded','activity_evidence',p_evidence_id,null,
    jsonb_build_object('review_id',v_review_id,'verified_by',p_verified_by,'evidence_location',p_evidence_location),null,null,null
  );
  return v_review_id;
end;
$$;
revoke all on function public.record_offline_evidence_review(uuid,text,uuid,timestamptz,text,boolean,text) from public;
grant execute on function public.record_offline_evidence_review(uuid,text,uuid,timestamptz,text,boolean,text) to authenticated;
