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

-- Tenant read policies; all writes go through governed commands.
foreach_placeholder
