-- Phase 4: permanent institutional scientific review committee, immutable submitted revisions,
-- collective review, chair decision, minutes and correction records.

insert into public.permissions(code,description) values
  ('committee.manage_structure','Record institutional committee appointment and members'),
  ('committee.prepare','Prepare committee meetings and activity reviews'),
  ('committee.record_collective','Record collective committee assessment'),
  ('committee.comment','Add committee review comments'),
  ('minutes.draft','Prepare committee minutes draft'),
  ('minutes.finalize','Finalize committee minutes'),
  ('activity.submit_committee','Submit an activity revision to the institutional committee')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='ORGANIZATION_SYSTEM_ADMIN' and p.code='committee.manage_structure'
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='COMMITTEE_SECRETARY' and p.code in ('committee.prepare','committee.record_collective','minutes.draft')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('COMMITTEE_MEMBER','COMMITTEE_CHAIR') and p.code='committee.comment'
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='COMMITTEE_CHAIR' and p.code='minutes.finalize'
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('ACTIVITY_OFFICER','ORGANIZATION_SYSTEM_ADMIN') and p.code='activity.submit_committee'
on conflict do nothing;

create table public.institutional_committees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  committee_name text not null,
  appointment_reference text not null,
  appointment_date date,
  appointed_by text,
  effective_from date not null,
  effective_to date,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE','EXPIRED')),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,organization_id),
  check(effective_to is null or effective_to >= effective_from)
);
create unique index institutional_committees_one_active_uq on public.institutional_committees(organization_id) where status='ACTIVE';
create trigger institutional_committees_set_updated_at before update on public.institutional_committees for each row execute function public.set_updated_at();

create table public.institutional_committee_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  committee_id uuid not null,
  user_id uuid references public.users(id),
  full_name_snapshot text not null,
  committee_role text not null check(committee_role in ('CHAIR','SECRETARY','MEMBER')),
  appointment_from date not null,
  appointment_to date,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE','ENDED')),
  created_at timestamptz not null default now(),
  unique(id,organization_id),
  foreign key(committee_id,organization_id) references public.institutional_committees(id,organization_id) on delete cascade,
  check(appointment_to is null or appointment_to >= appointment_from)
);
create unique index institutional_committee_one_active_chair_uq on public.institutional_committee_members(committee_id) where committee_role='CHAIR' and status='ACTIVE';
create unique index institutional_committee_one_active_secretary_uq on public.institutional_committee_members(committee_id) where committee_role='SECRETARY' and status='ACTIVE';

create table public.committee_meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  committee_id uuid not null,
  meeting_reference text,
  scheduled_at timestamptz not null,
  location_or_channel text,
  status text not null default 'SCHEDULED' check(status in ('SCHEDULED','HELD','CANCELLED','CLOSED')),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique(id,organization_id),
  foreign key(committee_id,organization_id) references public.institutional_committees(id,organization_id) on delete cascade
);

create table public.meeting_attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid not null,
  committee_member_id uuid not null,
  attendance_status text not null check(attendance_status in ('PRESENT','ABSENT','EXCUSED')),
  recorded_by uuid not null references public.users(id),
  recorded_at timestamptz not null default now(),
  unique(meeting_id,committee_member_id),
  foreign key(meeting_id,organization_id) references public.committee_meetings(id,organization_id) on delete cascade,
  foreign key(committee_member_id,organization_id) references public.institutional_committee_members(id,organization_id)
);

create table public.activity_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  revision_no integer not null check(revision_no > 0),
  parent_revision_id uuid,
  status text not null check(status in ('WORKING','SUBMITTED','RETURNED','FINAL_ACCEPTED','SUPERSEDED')),
  snapshot_json jsonb,
  snapshot_sha256 text,
  change_summary text,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  submitted_by uuid references public.users(id),
  submitted_at timestamptz,
  returned_at timestamptz,
  finalized_at timestamptz,
  unique(id,organization_id),
  unique(activity_id,revision_no),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade,
  foreign key(parent_revision_id,organization_id) references public.activity_revisions(id,organization_id),
  check((status='WORKING' and snapshot_sha256 is null) or status<>'WORKING'),
  check(snapshot_sha256 is null or snapshot_sha256 ~ '^[0-9a-fA-F]{64}$')
);

alter table public.activities
  add column if not exists working_revision_id uuid,
  add column if not exists latest_submitted_revision_id uuid;

alter table public.activities
  add constraint activities_working_revision_fk foreign key(working_revision_id,organization_id) references public.activity_revisions(id,organization_id),
  add constraint activities_latest_submitted_revision_fk foreign key(latest_submitted_revision_id,organization_id) references public.activity_revisions(id,organization_id);

create or replace function public.protect_activity_revision_snapshot()
returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then raise exception 'Activity revisions cannot be deleted'; end if;
  if old.status <> 'WORKING' and (
    new.snapshot_json is distinct from old.snapshot_json or
    new.snapshot_sha256 is distinct from old.snapshot_sha256 or
    new.revision_no is distinct from old.revision_no or
    new.parent_revision_id is distinct from old.parent_revision_id
  ) then
    raise exception 'Submitted activity revision snapshot is immutable';
  end if;
  return new;
end $$;
create trigger activity_revisions_protect before update or delete on public.activity_revisions for each row execute function public.protect_activity_revision_snapshot();

create table public.activity_revision_changes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  revision_id uuid not null,
  change_type text not null,
  field_key text,
  old_value jsonb,
  new_value jsonb,
  recorded_by uuid not null references public.users(id),
  recorded_at timestamptz not null default now(),
  foreign key(revision_id,organization_id) references public.activity_revisions(id,organization_id) on delete cascade
);

create table public.committee_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  revision_id uuid not null,
  meeting_id uuid,
  status text not null default 'DRAFT' check(status in ('DRAFT','RECORDED','DECIDED','CLOSED')),
  recorded_by uuid not null references public.users(id),
  recorded_at timestamptz not null default now(),
  unique(id,organization_id),
  unique(revision_id),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade,
  foreign key(revision_id,organization_id) references public.activity_revisions(id,organization_id),
  foreign key(meeting_id,organization_id) references public.committee_meetings(id,organization_id)
);

create table public.committee_standard_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_id uuid not null,
  criterion_code text not null,
  criterion_text text not null,
  source_rule_code text,
  evidence_availability text not null check(evidence_availability in ('UPLOADED','OFFLINE_REVIEWED','NOT_APPLICABLE','MISSING')),
  assessment text not null check(assessment in ('MEET','PARTIAL','NOT_MEET')),
  notes text,
  corrective_action text,
  recorded_by uuid not null references public.users(id),
  recorded_at timestamptz not null default now(),
  unique(review_id,criterion_code),
  foreign key(review_id,organization_id) references public.committee_reviews(id,organization_id) on delete cascade
);

create table public.committee_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_id uuid not null,
  comment_text text not null,
  commented_by uuid not null references public.users(id),
  role_context text not null,
  commented_at timestamptz not null default now(),
  foreign key(review_id,organization_id) references public.committee_reviews(id,organization_id) on delete cascade
);

create table public.committee_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  review_id uuid not null,
  revision_id uuid not null,
  decision text not null check(decision in ('APPROVED_FOR_SCFHS_SUBMISSION','RETURNED_FOR_CORRECTION','NOT_APPROVED')),
  decision_body text not null default 'INSTITUTIONAL_SCIENTIFIC_COMMITTEE',
  recorded_by uuid,
  final_decision_by uuid not null references public.users(id),
  decision_notes text,
  decided_at timestamptz not null default now(),
  unique(review_id),
  unique(id,organization_id),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade,
  foreign key(review_id,organization_id) references public.committee_reviews(id,organization_id),
  foreign key(revision_id,organization_id) references public.activity_revisions(id,organization_id)
);

create table public.committee_minutes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  review_id uuid not null,
  meeting_id uuid,
  version_no integer not null default 1 check(version_no > 0),
  status text not null default 'DRAFT' check(status in ('DRAFT','FINAL','SUPERSEDED')),
  snapshot_json jsonb,
  snapshot_sha256 text,
  prepared_by uuid not null references public.users(id),
  finalized_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  unique(review_id,version_no),
  unique(id,organization_id),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade,
  foreign key(review_id,organization_id) references public.committee_reviews(id,organization_id),
  foreign key(meeting_id,organization_id) references public.committee_meetings(id,organization_id),
  check(snapshot_sha256 is null or snapshot_sha256 ~ '^[0-9a-fA-F]{64}$')
);

create or replace function public.protect_final_committee_minutes()
returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then raise exception 'Committee minutes cannot be deleted'; end if;
  if old.status='FINAL' and (
    new.snapshot_json is distinct from old.snapshot_json or
    new.snapshot_sha256 is distinct from old.snapshot_sha256 or
    new.review_id is distinct from old.review_id or
    new.version_no is distinct from old.version_no
  ) then
    raise exception 'Final committee minutes are immutable';
  end if;
  return new;
end $$;
create trigger committee_minutes_protect before update or delete on public.committee_minutes for each row execute function public.protect_final_committee_minutes();

create table public.correction_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check(entity_type in ('COMMITTEE_MINUTES','COMMITTEE_DECISION')),
  entity_id uuid not null,
  reason text not null,
  requested_by uuid not null references public.users(id),
  requested_at timestamptz not null default now(),
  status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED','COMPLETED')),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz
);

-- RLS
alter table public.institutional_committees enable row level security;
alter table public.institutional_committee_members enable row level security;
alter table public.committee_meetings enable row level security;
alter table public.meeting_attendance enable row level security;
alter table public.activity_revisions enable row level security;
alter table public.activity_revision_changes enable row level security;
alter table public.committee_reviews enable row level security;
alter table public.committee_standard_results enable row level security;
alter table public.committee_comments enable row level security;
alter table public.committee_decisions enable row level security;
alter table public.committee_minutes enable row level security;
alter table public.correction_requests enable row level security;

create policy institutional_committees_read on public.institutional_committees for select to authenticated using(public.is_org_member(organization_id));
create policy institutional_committees_admin on public.institutional_committees for all to authenticated
using(public.current_user_has_permission(organization_id,'committee.manage_structure')) with check(public.current_user_has_permission(organization_id,'committee.manage_structure'));
create policy institutional_members_read on public.institutional_committee_members for select to authenticated using(public.is_org_member(organization_id));
create policy institutional_members_admin on public.institutional_committee_members for all to authenticated
using(public.current_user_has_permission(organization_id,'committee.manage_structure')) with check(public.current_user_has_permission(organization_id,'committee.manage_structure'));

create policy committee_meetings_read on public.committee_meetings for select to authenticated using(public.is_org_member(organization_id));
create policy meeting_attendance_read on public.meeting_attendance for select to authenticated using(public.is_org_member(organization_id));
create policy activity_revisions_read on public.activity_revisions for select to authenticated
using(exists(select 1 from public.activities a where a.id=activity_id and a.organization_id=organization_id));
create policy activity_revision_changes_read on public.activity_revision_changes for select to authenticated using(public.is_org_member(organization_id));
create policy committee_reviews_read on public.committee_reviews for select to authenticated using(public.is_org_member(organization_id));
create policy committee_standard_results_read on public.committee_standard_results for select to authenticated using(public.is_org_member(organization_id));
create policy committee_comments_read on public.committee_comments for select to authenticated using(public.is_org_member(organization_id));
create policy committee_decisions_read on public.committee_decisions for select to authenticated using(public.is_org_member(organization_id));
create policy committee_minutes_read on public.committee_minutes for select to authenticated using(public.is_org_member(organization_id));
create policy correction_requests_read on public.correction_requests for select to authenticated using(public.is_org_member(organization_id));

-- Sensitive writes go through governed commands in the next migration.
grant select on public.institutional_committees,public.institutional_committee_members,public.committee_meetings,public.meeting_attendance,
  public.activity_revisions,public.activity_revision_changes,public.committee_reviews,public.committee_standard_results,public.committee_comments,
  public.committee_decisions,public.committee_minutes,public.correction_requests to authenticated;
grant insert,update,delete on public.institutional_committees,public.institutional_committee_members to authenticated;
