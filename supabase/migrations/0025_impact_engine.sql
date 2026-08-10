-- Phase 6: versioned follow-up policies, L1-L4 results, internal HTVI and immutable impact report snapshots.

insert into public.permissions(code,description) values
  ('impact.manage','Record activity conduct and impact measurements'),
  ('impact.view','View impact follow-up and reports'),
  ('impact.finalize','Finalize impact report when methodology requirements are complete')
on conflict(code) do update set description=excluded.description;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('ORGANIZATION_SYSTEM_ADMIN','ACTIVITY_OFFICER') and p.code in ('impact.manage','impact.view','impact.finalize')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('COMMITTEE_SECRETARY','COMMITTEE_CHAIR','MANAGEMENT_VIEWER','MANAGEMENT_APPROVER','AUDITOR') and p.code='impact.view'
on conflict do nothing;

create table public.impact_followup_policies (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, version_label text not null, status text not null default 'DRAFT' check(status in ('DRAFT','ACTIVE','SUPERSEDED')),
  effective_from date, effective_to date, configured_by uuid not null references public.users(id), approved_by uuid references public.users(id),
  approved_at timestamptz, created_at timestamptz not null default now(), unique(organization_id,version_label), unique(id,organization_id)
);
create unique index impact_followup_one_active on public.impact_followup_policies(organization_id) where status='ACTIVE';

create table public.impact_followup_policy_levels (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  policy_id uuid not null, level text not null check(level in ('L1','L2','L3','L4')), due_offset_days integer not null check(due_offset_days>=0),
  grace_period_days integer not null default 0 check(grace_period_days>=0), required boolean not null default true,
  unique(policy_id,level), foreign key(policy_id,organization_id) references public.impact_followup_policies(id,organization_id) on delete cascade
);

create table public.impact_methodology_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null default 'HTVI', version_label text not null, status text not null default 'DRAFT' check(status in ('DRAFT','ACTIVE','SUPERSEDED')),
  weights jsonb not null default '{"L1":15,"L2":20,"L3":25,"L4":40}'::jsonb,
  rating_thresholds jsonb not null default '{"excellent":85,"very_good":75,"good":65}'::jsonb,
  configured_by uuid not null references public.users(id), approved_by uuid references public.users(id), approved_at timestamptz,
  created_at timestamptz not null default now(), unique(organization_id,version_label), unique(id,organization_id),
  check((weights->>'L1')::numeric>=0 and (weights->>'L2')::numeric>=0 and (weights->>'L3')::numeric>=0 and (weights->>'L4')::numeric>=0)
);
create unique index impact_methodology_one_active on public.impact_methodology_versions(organization_id) where status='ACTIVE';

create table public.activity_impact_schedules (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null, policy_id uuid not null, level text not null check(level in ('L1','L2','L3','L4')),
  due_at timestamptz not null, grace_until timestamptz not null, required boolean not null default true,
  override_reason text, override_approved_by uuid references public.users(id),
  status text not null default 'NOT_DUE' check(status in ('NOT_DUE','DUE','IN_PROGRESS','COMPLETED','OVERDUE','NOT_APPLICABLE')),
  completed_at timestamptz, unique(activity_id,level), unique(id,organization_id),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade,
  foreign key(policy_id,organization_id) references public.impact_followup_policies(id,organization_id)
);

create table public.impact_level_results (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null, level text not null check(level in ('L1','L2','L3','L4')), score numeric(7,3) check(score between 0 and 100),
  source_data jsonb, recorded_by uuid not null references public.users(id), recorded_at timestamptz not null default now(),
  unique(activity_id,level), foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade
);

create table public.impact_objectives (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null, source_learning_objective_id uuid, objective_text text not null,
  impact_domain text not null check(impact_domain in ('PATIENT_IMPACT','PRACTITIONER_IMPACT','QUALITY_SAFETY','SERVICE_EFFICIENCY')),
  indicator text, direction text not null check(direction in ('INCREASE','DECREASE')), baseline numeric, target numeric not null, post_value numeric,
  weight numeric(8,3) not null check(weight>0), achievement numeric(7,3), weighted_score numeric(10,4), data_source text,
  recorded_by uuid not null references public.users(id), updated_at timestamptz not null default now(), unique(id,organization_id),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade
);

create table public.impact_reports (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null, kind text not null check(kind in ('INTERIM','FINAL')), version_no integer not null default 1 check(version_no>0),
  status text not null check(status in ('DRAFT','FINAL','SUPERSEDED')), methodology_version_id uuid,
  htvi_status text not null check(htvi_status in ('PENDING','FINAL')), htvi_score numeric(7,3), overall_rating text,
  snapshot_json jsonb not null, snapshot_sha256 text not null, generated_by uuid not null references public.users(id), generated_at timestamptz not null default now(),
  finalized_at timestamptz, unique(activity_id,kind,version_no), unique(id,organization_id),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade,
  foreign key(methodology_version_id,organization_id) references public.impact_methodology_versions(id,organization_id),
  check((kind='FINAL' and htvi_status='FINAL' and htvi_score is not null and status='FINAL') or kind='INTERIM')
);

create or replace function public.protect_final_impact_report() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' and old.status='FINAL' then raise exception 'Final impact report is immutable'; end if;
  if tg_op='UPDATE' and old.status='FINAL' and (new.snapshot_json is distinct from old.snapshot_json or new.snapshot_sha256 is distinct from old.snapshot_sha256 or new.htvi_score is distinct from old.htvi_score or new.methodology_version_id is distinct from old.methodology_version_id) then
    raise exception 'Final impact report is immutable';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger impact_report_immutable before update or delete on public.impact_reports for each row execute function public.protect_final_impact_report();

alter table public.impact_followup_policies enable row level security;
alter table public.impact_followup_policy_levels enable row level security;
alter table public.impact_methodology_versions enable row level security;
alter table public.activity_impact_schedules enable row level security;
alter table public.impact_level_results enable row level security;
alter table public.impact_objectives enable row level security;
alter table public.impact_reports enable row level security;
create policy impact_policy_read on public.impact_followup_policies for select to authenticated using(public.is_org_member(organization_id));
create policy impact_policy_levels_read on public.impact_followup_policy_levels for select to authenticated using(public.is_org_member(organization_id));
create policy impact_methodology_read on public.impact_methodology_versions for select to authenticated using(public.is_org_member(organization_id));
create policy impact_schedule_read on public.activity_impact_schedules for select to authenticated using(public.is_org_member(organization_id));
create policy impact_level_read on public.impact_level_results for select to authenticated using(public.is_org_member(organization_id));
create policy impact_objective_read on public.impact_objectives for select to authenticated using(public.is_org_member(organization_id));
create policy impact_reports_read on public.impact_reports for select to authenticated using(public.is_org_member(organization_id));
grant select on public.impact_followup_policies,public.impact_followup_policy_levels,public.impact_methodology_versions,public.activity_impact_schedules,public.impact_level_results,public.impact_objectives,public.impact_reports to authenticated;

create or replace function public.configure_impact_followup_policy_command(p_organization_id uuid,p_role_context text,p_name text,p_version text,p_levels jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id uuid; v jsonb;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'methodology.configure') then raise exception using errcode='42501',message='Not authorized to configure follow-up policy'; end if;
  if jsonb_array_length(coalesce(p_levels,'[]'::jsonb))<>4 then raise exception using errcode='22023',message='L1-L4 policy levels are required'; end if;
  insert into public.impact_followup_policies(organization_id,name,version_label,status,configured_by) values(p_organization_id,p_name,p_version,'DRAFT',v_actor) returning id into v_id;
  for v in select * from jsonb_array_elements(p_levels) loop
    insert into public.impact_followup_policy_levels(organization_id,policy_id,level,due_offset_days,grace_period_days,required)
    values(p_organization_id,v_id,v->>'level',(v->>'dueOffsetDays')::int,coalesce((v->>'gracePeriodDays')::int,0),coalesce((v->>'required')::boolean,true));
  end loop;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'impact.followup_policy_configured','impact_followup_policy',v_id,null,jsonb_build_object('version',p_version),null,null,null);
  return v_id;
end $$;
revoke all on function public.configure_impact_followup_policy_command(uuid,text,text,text,jsonb) from public;
grant execute on function public.configure_impact_followup_policy_command(uuid,text,text,text,jsonb) to authenticated;

create or replace function public.approve_impact_followup_policy_command(p_organization_id uuid,p_role_context text,p_policy_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'methodology.approve') then raise exception using errcode='42501',message='Management approval is required'; end if;
  update public.impact_followup_policies set status='SUPERSEDED' where organization_id=p_organization_id and status='ACTIVE' and id<>p_policy_id;
  update public.impact_followup_policies set status='ACTIVE',approved_by=v_actor,approved_at=now(),effective_from=coalesce(effective_from,current_date) where id=p_policy_id and organization_id=p_organization_id and status='DRAFT';
  if not found then raise exception using errcode='22023',message='Draft follow-up policy not found'; end if;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'impact.followup_policy_approved','impact_followup_policy',p_policy_id,null,null,null,null,null);
end $$;
revoke all on function public.approve_impact_followup_policy_command(uuid,text,uuid) from public;
grant execute on function public.approve_impact_followup_policy_command(uuid,text,uuid) to authenticated;

create or replace function public.configure_impact_methodology_command(p_organization_id uuid,p_role_context text,p_version text,p_weights jsonb,p_thresholds jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id uuid; v_total numeric;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'methodology.configure') then raise exception using errcode='42501',message='Not authorized to configure impact methodology'; end if;
  v_total:=coalesce((p_weights->>'L1')::numeric,0)+coalesce((p_weights->>'L2')::numeric,0)+coalesce((p_weights->>'L3')::numeric,0)+coalesce((p_weights->>'L4')::numeric,0);
  if v_total<>100 then raise exception using errcode='22023',message='HTVI weights must total 100'; end if;
  insert into public.impact_methodology_versions(organization_id,version_label,status,weights,rating_thresholds,configured_by)
  values(p_organization_id,p_version,'DRAFT',p_weights,p_thresholds,v_actor) returning id into v_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'impact.methodology_configured','impact_methodology',v_id,null,jsonb_build_object('version',p_version,'weights',p_weights),null,null,null);
  return v_id;
end $$;
revoke all on function public.configure_impact_methodology_command(uuid,text,text,jsonb,jsonb) from public;
grant execute on function public.configure_impact_methodology_command(uuid,text,text,jsonb,jsonb) to authenticated;

create or replace function public.approve_impact_methodology_command(p_organization_id uuid,p_role_context text,p_methodology_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'methodology.approve') then raise exception using errcode='42501',message='Management approval is required'; end if;
  update public.impact_methodology_versions set status='SUPERSEDED' where organization_id=p_organization_id and status='ACTIVE' and id<>p_methodology_id;
  update public.impact_methodology_versions set status='ACTIVE',approved_by=v_actor,approved_at=now() where id=p_methodology_id and organization_id=p_organization_id and status='DRAFT';
  if not found then raise exception using errcode='22023',message='Draft methodology not found'; end if;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'impact.methodology_approved','impact_methodology',p_methodology_id,null,null,null,null,null);
end $$;
revoke all on function public.approve_impact_methodology_command(uuid,text,uuid) from public;
grant execute on function public.approve_impact_methodology_command(uuid,text,uuid) to authenticated;

create or replace function public.refresh_impact_schedule_statuses(p_organization_id uuid,p_activity_id uuid default null)
returns void language sql security definer set search_path='' as $$
  update public.activity_impact_schedules s set status=case
    when s.status in ('COMPLETED','NOT_APPLICABLE') then s.status
    when now()<s.due_at then 'NOT_DUE'
    when now()>s.grace_until then 'OVERDUE'
    else 'DUE' end
  where s.organization_id=p_organization_id and (p_activity_id is null or s.activity_id=p_activity_id);
$$;
revoke all on function public.refresh_impact_schedule_statuses(uuid,uuid) from public;
grant execute on function public.refresh_impact_schedule_statuses(uuid,uuid) to authenticated;

create or replace function public.mark_activity_conducted_command(p_organization_id uuid,p_role_context text,p_activity_id uuid,p_conducted_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_policy uuid; v_level record; v_state text;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'impact.manage') then raise exception using errcode='42501',message='Not authorized to manage impact'; end if;
  if p_role_context='ACTIVITY_OFFICER' and not public.current_user_is_assigned_activity(p_activity_id) then raise exception using errcode='42501',message='Activity Officer is not assigned'; end if;
  if not exists(select 1 from public.external_submission_records where organization_id=p_organization_id and activity_id=p_activity_id and status='APPROVED') then raise exception using errcode='22023',message='External approval must be recorded before activity conduct in this workflow'; end if;
  select id into v_policy from public.impact_followup_policies where organization_id=p_organization_id and status='ACTIVE' and (effective_from is null or effective_from<=p_conducted_at::date) and (effective_to is null or effective_to>=p_conducted_at::date) order by approved_at desc limit 1;
  if v_policy is null then raise exception using errcode='22023',message='No active impact follow-up policy'; end if;
  select internal_state into v_state from public.activities where id=p_activity_id and organization_id=p_organization_id for update;
  for v_level in select * from public.impact_followup_policy_levels where policy_id=v_policy order by level loop
    insert into public.activity_impact_schedules(organization_id,activity_id,policy_id,level,due_at,grace_until,required,status)
    values(p_organization_id,p_activity_id,v_policy,v_level.level,p_conducted_at+(v_level.due_offset_days||' days')::interval,p_conducted_at+((v_level.due_offset_days+v_level.grace_period_days)||' days')::interval,v_level.required,
      case when now()<p_conducted_at+(v_level.due_offset_days||' days')::interval then 'NOT_DUE' else 'DUE' end)
    on conflict(activity_id,level) do nothing;
  end loop;
  update public.activities set internal_state='IMPACT_FOLLOWUP' where id=p_activity_id;
  insert into public.activity_status_history(organization_id,activity_id,from_state,to_state,changed_by,role_context,reason)
  values(p_organization_id,p_activity_id,v_state,'IMPACT_FOLLOWUP',v_actor,p_role_context,'Activity conducted; impact schedules generated from approved policy');
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'impact.followup_started','activity',p_activity_id,null,jsonb_build_object('policy_id',v_policy,'conducted_at',p_conducted_at),null,null,null);
end $$;
revoke all on function public.mark_activity_conducted_command(uuid,text,uuid,timestamptz) from public;
grant execute on function public.mark_activity_conducted_command(uuid,text,uuid,timestamptz) to authenticated;

create or replace function public.record_impact_level_command(p_organization_id uuid,p_role_context text,p_activity_id uuid,p_level text,p_score numeric,p_source_data jsonb default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_schedule uuid; v_status text; v_id uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'impact.manage') then raise exception using errcode='42501',message='Not authorized'; end if;
  if p_score<0 or p_score>100 then raise exception using errcode='22023',message='Impact score must be 0-100'; end if;
  perform public.refresh_impact_schedule_statuses(p_organization_id,p_activity_id);
  select id,status into v_schedule,v_status from public.activity_impact_schedules where organization_id=p_organization_id and activity_id=p_activity_id and level=p_level for update;
  if v_schedule is null then raise exception using errcode='22023',message='Impact schedule not found'; end if;
  if v_status='NOT_DUE' then raise exception using errcode='22023',message='Impact level is not due yet'; end if;
  insert into public.impact_level_results(organization_id,activity_id,level,score,source_data,recorded_by)
  values(p_organization_id,p_activity_id,p_level,round(p_score,3),p_source_data,v_actor)
  on conflict(activity_id,level) do update set score=excluded.score,source_data=excluded.source_data,recorded_by=v_actor,recorded_at=now()
  returning id into v_id;
  update public.activity_impact_schedules set status='COMPLETED',completed_at=now() where id=v_schedule;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'impact.level_recorded','activity',p_activity_id,null,jsonb_build_object('level',p_level,'score',p_score),null,null,null);
  return v_id;
end $$;
revoke all on function public.record_impact_level_command(uuid,text,uuid,text,numeric,jsonb) from public;
grant execute on function public.record_impact_level_command(uuid,text,uuid,text,numeric,jsonb) to authenticated;

create or replace function public.record_impact_objectives_command(p_organization_id uuid,p_role_context text,p_activity_id uuid,p_objectives jsonb)
returns numeric language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v jsonb; v_achievement numeric; v_weighted numeric; v_l4 numeric;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'impact.manage') then raise exception using errcode='42501',message='Not authorized'; end if;
  perform public.refresh_impact_schedule_statuses(p_organization_id,p_activity_id);
  if (select status from public.activity_impact_schedules where organization_id=p_organization_id and activity_id=p_activity_id and level='L4')='NOT_DUE' then raise exception using errcode='22023',message='L4 is not due yet'; end if;
  delete from public.impact_objectives where organization_id=p_organization_id and activity_id=p_activity_id;
  for v in select * from jsonb_array_elements(coalesce(p_objectives,'[]'::jsonb)) loop
    if (v->>'target')::numeric<0 or (v->>'postValue')::numeric<0 then raise exception using errcode='22023',message='Target and post values must be non-negative'; end if;
    if v->>'direction'='INCREASE' then
      if (v->>'target')::numeric=0 then raise exception using errcode='22023',message='Increase target cannot be zero'; end if;
      v_achievement:=least(((v->>'postValue')::numeric/(v->>'target')::numeric)*100,100);
    elsif v->>'direction'='DECREASE' then
      if (v->>'postValue')::numeric <= (v->>'target')::numeric then v_achievement:=100;
      elsif (v->>'postValue')::numeric=0 then v_achievement:=100;
      else v_achievement:=least(((v->>'target')::numeric/(v->>'postValue')::numeric)*100,100); end if;
    else raise exception using errcode='22023',message='Invalid objective direction'; end if;
    v_weighted:=v_achievement*(v->>'weight')::numeric/100;
    insert into public.impact_objectives(organization_id,activity_id,objective_text,impact_domain,indicator,direction,baseline,target,post_value,weight,achievement,weighted_score,data_source,recorded_by)
    values(p_organization_id,p_activity_id,v->>'objectiveText',v->>'impactDomain',v->>'indicator',v->>'direction',nullif(v->>'baseline','')::numeric,(v->>'target')::numeric,(v->>'postValue')::numeric,(v->>'weight')::numeric,round(v_achievement,3),round(v_weighted,4),v->>'dataSource',v_actor);
  end loop;
  select round(sum(achievement*weight)/nullif(sum(weight),0),3) into v_l4 from public.impact_objectives where organization_id=p_organization_id and activity_id=p_activity_id;
  if v_l4 is null then raise exception using errcode='22023',message='At least one L4 impact objective is required'; end if;
  perform public.record_impact_level_command(p_organization_id,p_role_context,p_activity_id,'L4',v_l4,jsonb_build_object('source','impact_objectives'));
  return v_l4;
end $$;
revoke all on function public.record_impact_objectives_command(uuid,text,uuid,jsonb) from public;
grant execute on function public.record_impact_objectives_command(uuid,text,uuid,jsonb) to authenticated;

create or replace function public.generate_impact_report_command(p_organization_id uuid,p_role_context text,p_activity_id uuid,p_kind text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_method uuid; v_weights jsonb; v_thresholds jsonb; v_scores jsonb; v_domains jsonb; v_objectives jsonb; v_snapshot jsonb; v_hash text; v_htvi numeric; v_rating text; v_version int; v_id uuid; v_state text;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'impact.finalize') then raise exception using errcode='42501',message='Not authorized to generate impact report'; end if;
  if p_kind not in ('INTERIM','FINAL') then raise exception using errcode='22023',message='Invalid impact report kind'; end if;
  perform public.refresh_impact_schedule_statuses(p_organization_id,p_activity_id);
  select id,weights,rating_thresholds into v_method,v_weights,v_thresholds from public.impact_methodology_versions where organization_id=p_organization_id and status='ACTIVE' order by approved_at desc limit 1;
  if v_method is null then raise exception using errcode='22023',message='No approved active HTVI methodology'; end if;
  select coalesce(jsonb_object_agg(level,score),'{}'::jsonb) into v_scores from public.impact_level_results where organization_id=p_organization_id and activity_id=p_activity_id;
  select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) into v_objectives from public.impact_objectives o where organization_id=p_organization_id and activity_id=p_activity_id;
  select coalesce(jsonb_object_agg(impact_domain,domain_score),'{}'::jsonb) into v_domains from (
    select impact_domain,round(sum(achievement*weight)/nullif(sum(weight),0),3) domain_score from public.impact_objectives where organization_id=p_organization_id and activity_id=p_activity_id group by impact_domain
  ) d;
  if p_kind='FINAL' then
    if exists(select 1 from public.activity_impact_schedules where organization_id=p_organization_id and activity_id=p_activity_id and required=true and status<>'COMPLETED') then raise exception using errcode='22023',message='Required impact components are incomplete; HTVI remains PENDING'; end if;
    if not (v_scores ? 'L1' and v_scores ? 'L2' and v_scores ? 'L3' and v_scores ? 'L4') then raise exception using errcode='22023',message='L1-L4 scores are required for HTVI v1'; end if;
    v_htvi:=round((((v_scores->>'L1')::numeric*(v_weights->>'L1')::numeric)+((v_scores->>'L2')::numeric*(v_weights->>'L2')::numeric)+((v_scores->>'L3')::numeric*(v_weights->>'L3')::numeric)+((v_scores->>'L4')::numeric*(v_weights->>'L4')::numeric))/100,3);
    v_rating:=case when v_htvi>=(v_thresholds->>'excellent')::numeric then 'EXCELLENT' when v_htvi>=(v_thresholds->>'very_good')::numeric then 'VERY_GOOD' when v_htvi>=(v_thresholds->>'good')::numeric then 'GOOD' else 'NEEDS_IMPROVEMENT' end;
  end if;
  v_snapshot:=jsonb_build_object('activity_id',p_activity_id,'kind',p_kind,'methodology_version_id',v_method,'weights',v_weights,'level_scores',v_scores,'impact_domains',v_domains,'objectives',v_objectives,'htvi_status',case when p_kind='FINAL' then 'FINAL' else 'PENDING' end,'htvi',v_htvi,'overall_rating',v_rating);
  v_hash:=encode(digest(v_snapshot::text,'sha256'),'hex');
  select coalesce(max(version_no),0)+1 into v_version from public.impact_reports where organization_id=p_organization_id and activity_id=p_activity_id and kind=p_kind;
  if p_kind='FINAL' then update public.impact_reports set status='SUPERSEDED' where organization_id=p_organization_id and activity_id=p_activity_id and kind='FINAL' and status='FINAL'; end if;
  insert into public.impact_reports(organization_id,activity_id,kind,version_no,status,methodology_version_id,htvi_status,htvi_score,overall_rating,snapshot_json,snapshot_sha256,generated_by,finalized_at)
  values(p_organization_id,p_activity_id,p_kind,v_version,case when p_kind='FINAL' then 'FINAL' else 'DRAFT' end,v_method,case when p_kind='FINAL' then 'FINAL' else 'PENDING' end,v_htvi,v_rating,v_snapshot,v_hash,v_actor,case when p_kind='FINAL' then now() else null end)
  returning id into v_id;
  if p_kind='FINAL' then
    select internal_state into v_state from public.activities where id=p_activity_id for update;
    update public.activities set internal_state='FINAL_IMPACT_REPORT' where id=p_activity_id;
    insert into public.activity_status_history(organization_id,activity_id,from_state,to_state,changed_by,role_context,reason) values(p_organization_id,p_activity_id,v_state,'FINAL_IMPACT_REPORT',v_actor,p_role_context,'Final impact report generated');
  end if;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'impact.report_generated','impact_report',v_id,null,jsonb_build_object('kind',p_kind,'htvi_status',case when p_kind='FINAL' then 'FINAL' else 'PENDING' end,'htvi',v_htvi,'snapshot_sha256',v_hash),null,null,null);
  return v_id;
end $$;
revoke all on function public.generate_impact_report_command(uuid,text,uuid,text) from public;
grant execute on function public.generate_impact_report_command(uuid,text,uuid,text) to authenticated;
