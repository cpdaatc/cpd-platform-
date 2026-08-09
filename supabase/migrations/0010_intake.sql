-- Phase 2: Digital/PDF/Hybrid intake converging into one structured activity record.

create or replace function public.user_has_permission_in_org(
  p_user_id uuid,
  p_organization_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    join public.user_roles ur on ur.membership_id=m.id and ur.organization_id=m.organization_id
    join public.role_permissions rp on rp.role_id=ur.role_id
    join public.permissions p on p.id=rp.permission_id
    where m.user_id=p_user_id
      and m.organization_id=p_organization_id
      and m.status='ACTIVE'
      and p.code=p_permission_code
  );
$$;
revoke all on function public.user_has_permission_in_org(uuid,uuid,text) from public;
grant execute on function public.user_has_permission_in_org(uuid,uuid,text) to authenticated, service_role;

create or replace function public.can_edit_activity_intake(p_organization_id uuid, p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.current_user_has_permission(p_organization_id,'activity.fill_submit')
    and (
      public.current_user_has_permission(p_organization_id,'activity.view.all')
      or public.current_user_is_assigned_activity(p_activity_id)
    );
$$;
revoke all on function public.can_edit_activity_intake(uuid,uuid) from public;
grant execute on function public.can_edit_activity_intake(uuid,uuid) to authenticated, service_role;

create table public.activity_intake_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  intake_route text not null default 'DIGITAL' check (intake_route in ('DIGITAL','PDF','HYBRID')),
  specialty text,
  activity_languages text[] not null default '{}',
  collaboration boolean,
  collaborator_organization_name text,
  collaborator_type text,
  content_developed_by_provider boolean,
  content_developer text,
  target_audience text,
  select_all_medical_fields boolean not null default false,
  category_specific text,
  learning_gap text,
  aim_and_outcomes text,
  learning_methods text,
  participant_evaluation_method text,
  activity_scope text check (activity_scope in ('LOCAL','INTERNATIONAL')),
  scfhs_registration_number text,
  form_status text not null default 'DRAFT' check (form_status in ('DRAFT','CONFIRMED','SUBMITTED')),
  confirmed_by uuid references public.users(id),
  confirmed_at timestamptz,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(activity_id),
  unique(id,organization_id),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade,
  check (collaboration is distinct from true or collaborator_organization_name is not null),
  check (content_developed_by_provider is distinct from false or content_developer is not null)
);
create trigger activity_intake_profiles_set_updated_at before update on public.activity_intake_profiles
for each row execute function public.set_updated_at();

create table public.activity_needs_assessment_tools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  tool_code text not null check (tool_code in ('SURVEY','QUESTIONNAIRE','PLANNING_COMMITTEE_CONSULTATION','FOCUS_GROUP','DIRECT_TARGET_AUDIENCE_REQUEST','OTHER')),
  other_text text,
  created_at timestamptz not null default now(),
  unique(activity_id,tool_code),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade,
  check (tool_code <> 'OTHER' or other_text is not null)
);

create table public.activity_learning_objectives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  objective_text text not null,
  learning_domain text check (learning_domain in ('KNOWLEDGE','SKILL','ATTITUDE')),
  sort_order integer not null default 1 check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade
);
create trigger activity_learning_objectives_set_updated_at before update on public.activity_learning_objectives
for each row execute function public.set_updated_at();

create table public.activity_scientific_committees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','FINALIZED')),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  unique(activity_id),
  unique(id,organization_id),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade
);

create table public.activity_scientific_committee_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_scientific_committee_id uuid not null,
  full_name text not null,
  professional_classification_number text,
  specialty text,
  institution text,
  committee_role text,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  foreign key(activity_scientific_committee_id,organization_id)
    references public.activity_scientific_committees(id,organization_id) on delete cascade
);

create table public.intake_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  document_role text not null check (document_role in ('COMPLETED_ACTIVITY_FORM','SUPPORTING_DOCUMENT')),
  original_filename text not null,
  storage_path text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-fA-F]{64}$'),
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  uploaded_by uuid not null references public.users(id),
  uploaded_at timestamptz not null default now(),
  unique(organization_id,sha256,storage_path),
  unique(id,organization_id),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade
);

create or replace function public.block_intake_document_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Original intake documents are immutable; add a new document version instead';
end;
$$;
create trigger intake_documents_no_update before update on public.intake_documents
for each row execute function public.block_intake_document_mutation();
create trigger intake_documents_no_delete before delete on public.intake_documents
for each row execute function public.block_intake_document_mutation();

create table public.extraction_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  document_id uuid not null,
  engine text not null check (engine in ('NATIVE_PDF','LAYOUT','OCR','VISION','HYBRID')),
  status text not null default 'PENDING' check (status in ('PENDING','RUNNING','COMPLETED','FAILED')),
  error_message text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(id,organization_id),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade,
  foreign key(document_id,organization_id) references public.intake_documents(id,organization_id)
);

create table public.extraction_field_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  extraction_run_id uuid not null,
  field_key text not null,
  raw_value text,
  normalized_value text,
  page_number integer check (page_number is null or page_number > 0),
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status text not null check (status in ('EXTRACTED','UNCERTAIN','CONFIRMED','CORRECTED')),
  confirmed_by uuid references public.users(id),
  confirmed_at timestamptz,
  unique(extraction_run_id,field_key),
  foreign key(extraction_run_id,organization_id) references public.extraction_runs(id,organization_id) on delete cascade
);

create table public.speakers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  specialty text,
  grade text,
  institution text,
  mobile text,
  email text,
  scfhs_registration_number text,
  is_active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,organization_id)
);
create trigger speakers_set_updated_at before update on public.speakers
for each row execute function public.set_updated_at();

create table public.activity_speakers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  speaker_id uuid,
  full_name_snapshot text not null,
  specialty_snapshot text,
  grade_snapshot text,
  institution_snapshot text,
  related_experience_past_three_years text,
  qualifications_summary text,
  special_certificates_summary text,
  international_presentations_count integer check (international_presentations_count is null or international_presentations_count >= 0),
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  unique(id,organization_id),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade,
  foreign key(speaker_id,organization_id) references public.speakers(id,organization_id)
);

create table public.speaker_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  speaker_id uuid not null,
  document_type text not null default 'CV' check (document_type in ('CV','CERTIFICATE','OTHER')),
  storage_path text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-fA-F]{64}$'),
  version_no integer not null default 1 check (version_no > 0),
  uploaded_by uuid references public.users(id),
  uploaded_at timestamptz not null default now(),
  foreign key(speaker_id,organization_id) references public.speakers(id,organization_id) on delete cascade,
  unique(speaker_id,document_type,version_no)
);

create table public.activity_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  day_label text,
  topic_name text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 1,
  unique(id,organization_id),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade,
  check (starts_at is null or ends_at is null or ends_at >= starts_at)
);

create table public.session_speakers (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null,
  activity_speaker_id uuid not null,
  primary key(session_id,activity_speaker_id),
  foreign key(session_id,organization_id) references public.activity_sessions(id,organization_id) on delete cascade,
  foreign key(activity_speaker_id,organization_id) references public.activity_speakers(id,organization_id) on delete cascade
);

create table public.activity_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  evidence_type text not null,
  status text not null check (status in ('UPLOADED','OFFLINE_REVIEWED','NOT_APPLICABLE','MISSING')),
  storage_path text,
  sha256 text,
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,organization_id),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade,
  check (status <> 'UPLOADED' or storage_path is not null),
  check (sha256 is null or sha256 ~ '^[0-9a-fA-F]{64}$')
);
create trigger activity_evidence_set_updated_at before update on public.activity_evidence
for each row execute function public.set_updated_at();

create table public.evidence_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence_id uuid not null,
  review_status text not null check (review_status in ('OFFLINE_REVIEWED','NOT_APPLICABLE_REVIEW')),
  recorded_by uuid not null references public.users(id),
  verified_by uuid not null references public.users(id),
  verified_at timestamptz not null,
  evidence_location text not null,
  original_exists_confirmed boolean not null,
  reason text,
  created_at timestamptz not null default now(),
  foreign key(evidence_id,organization_id) references public.activity_evidence(id,organization_id) on delete cascade,
  check (review_status <> 'OFFLINE_REVIEWED' or original_exists_confirmed=true)
);

create table public.disclosure_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  person_name text not null,
  person_role text not null,
  declaration_status text not null default 'PENDING' check (declaration_status in ('PENDING','DECLARED_NO_CONFLICT','DECLARED_CONFLICT')),
  commercial_relationship_summary text,
  evidence_id uuid,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade,
  foreign key(evidence_id,organization_id) references public.activity_evidence(id,organization_id)
);
create trigger disclosure_records_set_updated_at before update on public.disclosure_records
for each row execute function public.set_updated_at();

-- RLS: users may only see intake for activities they can see; writes require activity.fill_submit and assignment/admin scope.

do $$
declare t text;
begin
  foreach t in array array[
    'activity_intake_profiles','activity_needs_assessment_tools','activity_learning_objectives',
    'activity_scientific_committees','activity_scientific_committee_members','intake_documents',
    'extraction_runs','extraction_field_results','activity_speakers','activity_sessions','session_speakers',
    'activity_evidence','evidence_reviews','disclosure_records'
  ] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

alter table public.speakers enable row level security;
alter table public.speaker_documents enable row level security;

-- Explicit activity-scoped policies.
create policy intake_profiles_select on public.activity_intake_profiles for select to authenticated
using (exists(select 1 from public.activities a where a.id=activity_id and a.organization_id=organization_id));
create policy intake_profiles_write on public.activity_intake_profiles for all to authenticated
using (public.can_edit_activity_intake(organization_id,activity_id))
with check (public.can_edit_activity_intake(organization_id,activity_id));

create policy needs_tools_select on public.activity_needs_assessment_tools for select to authenticated
using (exists(select 1 from public.activities a where a.id=activity_id and a.organization_id=organization_id));
create policy needs_tools_write on public.activity_needs_assessment_tools for all to authenticated
using (public.can_edit_activity_intake(organization_id,activity_id)) with check (public.can_edit_activity_intake(organization_id,activity_id));

create policy learning_objectives_select on public.activity_learning_objectives for select to authenticated
using (exists(select 1 from public.activities a where a.id=activity_id and a.organization_id=organization_id));
create policy learning_objectives_write on public.activity_learning_objectives for all to authenticated
using (public.can_edit_activity_intake(organization_id,activity_id)) with check (public.can_edit_activity_intake(organization_id,activity_id));

create policy activity_scientific_committees_select on public.activity_scientific_committees for select to authenticated
using (exists(select 1 from public.activities a where a.id=activity_id and a.organization_id=organization_id));
create policy activity_scientific_committees_write on public.activity_scientific_committees for all to authenticated
using (public.can_edit_activity_intake(organization_id,activity_id)) with check (public.can_edit_activity_intake(organization_id,activity_id));
create policy activity_scientific_members_org on public.activity_scientific_committee_members for all to authenticated
using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy intake_documents_select on public.intake_documents for select to authenticated
using (exists(select 1 from public.activities a where a.id=activity_id and a.organization_id=organization_id));
create policy intake_documents_insert on public.intake_documents for insert to authenticated
with check (public.can_edit_activity_intake(organization_id,activity_id) and uploaded_by=auth.uid());

create policy extraction_runs_select on public.extraction_runs for select to authenticated
using (exists(select 1 from public.activities a where a.id=activity_id and a.organization_id=organization_id));
create policy extraction_runs_write on public.extraction_runs for all to authenticated
using (public.can_edit_activity_intake(organization_id,activity_id)) with check (public.can_edit_activity_intake(organization_id,activity_id));
create policy extraction_fields_org on public.extraction_field_results for all to authenticated
using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy speakers_select on public.speakers for select to authenticated using (public.is_org_member(organization_id));
create policy speakers_write on public.speakers for all to authenticated
using (public.current_user_has_permission(organization_id,'activity.fill_submit'))
with check (public.current_user_has_permission(organization_id,'activity.fill_submit'));
create policy speaker_documents_org on public.speaker_documents for all to authenticated
using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy activity_speakers_select on public.activity_speakers for select to authenticated
using (exists(select 1 from public.activities a where a.id=activity_id and a.organization_id=organization_id));
create policy activity_speakers_write on public.activity_speakers for all to authenticated
using (public.can_edit_activity_intake(organization_id,activity_id)) with check (public.can_edit_activity_intake(organization_id,activity_id));
create policy activity_sessions_select on public.activity_sessions for select to authenticated
using (exists(select 1 from public.activities a where a.id=activity_id and a.organization_id=organization_id));
create policy activity_sessions_write on public.activity_sessions for all to authenticated
using (public.can_edit_activity_intake(organization_id,activity_id)) with check (public.can_edit_activity_intake(organization_id,activity_id));
create policy session_speakers_org on public.session_speakers for all to authenticated
using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy evidence_select on public.activity_evidence for select to authenticated
using (exists(select 1 from public.activities a where a.id=activity_id and a.organization_id=organization_id));
create policy evidence_write on public.activity_evidence for all to authenticated
using (public.can_edit_activity_intake(organization_id,activity_id) or public.current_user_has_permission(organization_id,'evidence.record_offline'))
with check (public.can_edit_activity_intake(organization_id,activity_id) or public.current_user_has_permission(organization_id,'evidence.record_offline'));
create policy evidence_reviews_select on public.evidence_reviews for select to authenticated using (public.is_org_member(organization_id));
create policy evidence_reviews_insert on public.evidence_reviews for insert to authenticated
with check (public.current_user_has_permission(organization_id,'evidence.record_offline') and recorded_by=auth.uid());
create policy disclosures_select on public.disclosure_records for select to authenticated
using (exists(select 1 from public.activities a where a.id=activity_id and a.organization_id=organization_id));
create policy disclosures_write on public.disclosure_records for all to authenticated
using (public.can_edit_activity_intake(organization_id,activity_id)) with check (public.can_edit_activity_intake(organization_id,activity_id));

-- Minimal table privileges; final authorization remains RLS/server-side.
grant select,insert,update on public.activity_intake_profiles,public.activity_needs_assessment_tools,public.activity_learning_objectives,
  public.activity_scientific_committees,public.activity_scientific_committee_members,public.extraction_runs,public.extraction_field_results,
  public.speakers,public.speaker_documents,public.activity_speakers,public.activity_sessions,public.session_speakers,
  public.activity_evidence,public.evidence_reviews,public.disclosure_records to authenticated;
grant select,insert on public.intake_documents to authenticated;

create or replace function public.record_offline_evidence_review(
  p_evidence_id uuid,
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
begin
  select organization_id into v_org from public.activity_evidence where id=p_evidence_id;
  if v_org is null then raise exception 'Evidence not found'; end if;
  if not public.current_user_has_permission(v_org,'evidence.record_offline') then raise exception 'Not authorized to record offline evidence'; end if;
  if not public.user_has_permission_in_org(p_verified_by,v_org,'evidence.verify_offline') then raise exception 'Verifier is not authorized'; end if;
  if p_verified_at is null or nullif(trim(p_evidence_location),'') is null or p_original_exists_confirmed is not true then
    raise exception 'Offline review requires verifier, date, location, and confirmation that the original existed';
  end if;
  update public.activity_evidence set status='OFFLINE_REVIEWED', updated_at=now() where id=p_evidence_id;
  insert into public.evidence_reviews(organization_id,evidence_id,review_status,recorded_by,verified_by,verified_at,evidence_location,original_exists_confirmed,reason)
  values(v_org,p_evidence_id,'OFFLINE_REVIEWED',auth.uid(),p_verified_by,p_verified_at,p_evidence_location,true,p_reason)
  returning id into v_review_id;
  return v_review_id;
end;
$$;
revoke all on function public.record_offline_evidence_review(uuid,uuid,timestamptz,text,boolean,text) from public;
grant execute on function public.record_offline_evidence_review(uuid,uuid,timestamptz,text,boolean,text) to authenticated;
