-- Phase 3: versioned source/rule registry, source-conflict queue, privacy-gated AI settings,
-- deterministic/AI review persistence, and human acceptance events.

insert into public.permissions(code,description) values
  ('ai.run_prereview','Run deterministic or approved AI pre-review'),
  ('ai.manage_references','Manage organization reference and rule metadata'),
  ('ai.resolve_source_conflict','Resolve documented source conflicts')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('ORGANIZATION_SYSTEM_ADMIN','ACTIVITY_OFFICER','COMMITTEE_SECRETARY','COMMITTEE_CHAIR','COMMITTEE_MEMBER')
  and p.code='ai.run_prereview'
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='ORGANIZATION_SYSTEM_ADMIN' and p.code='ai.manage_references'
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('COMMITTEE_CHAIR','ORGANIZATION_SYSTEM_ADMIN') and p.code='ai.resolve_source_conflict'
on conflict do nothing;

create table public.reference_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  source_code text not null,
  title text not null,
  source_type text not null check (source_type in ('REGULATORY','ACCREDITATION_STANDARD','OPERATIONAL_GUIDANCE','ETHICS','EDUCATIONAL_GUIDANCE','INTERNAL_POLICY')),
  authority_level integer not null check (authority_level between 1 and 5),
  version_label text not null,
  effective_from date,
  effective_to date,
  status text not null default 'ACTIVE' check (status in ('DRAFT','ACTIVE','SUPERSEDED','EXPIRED')),
  source_uri text,
  checksum text,
  is_global boolean not null default false,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  unique(source_code,version_label,organization_id),
  check ((is_global and organization_id is null) or (not is_global and organization_id is not null))
);

create unique index reference_documents_global_uq
on public.reference_documents(source_code,version_label)
where organization_id is null;

create table public.regulatory_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  rule_code text not null,
  title text not null,
  rule_scope text not null check (rule_scope in ('ACTIVITY_ACCREDITATION','PROVIDER_ACCREDITATION','INTERNAL_GOVERNANCE','EDUCATIONAL_GUIDANCE','SPECIALIZED_PROGRAM')),
  requirement_type text not null default 'REQUIRED' check (requirement_type in ('REQUIRED','GUIDANCE','INTERNAL_CONTROL')),
  status text not null default 'ACTIVE' check (status in ('DRAFT','ACTIVE','SUPERSEDED','INACTIVE')),
  created_at timestamptz not null default now(),
  unique(rule_code,organization_id)
);

create unique index regulatory_rules_global_uq on public.regulatory_rules(rule_code) where organization_id is null;

create table public.rule_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  rule_id uuid not null references public.regulatory_rules(id) on delete cascade,
  source_document_id uuid not null references public.reference_documents(id),
  version_label text not null,
  requirement_summary text not null,
  evidence_expected text,
  effective_from date,
  effective_to date,
  ai_check_supported boolean not null default false,
  human_confirmation_required boolean not null default true,
  status text not null default 'ACTIVE' check (status in ('DRAFT','ACTIVE','SUPERSEDED','EXPIRED')),
  created_at timestamptz not null default now(),
  unique(rule_id,version_label)
);

create table public.source_conflicts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_code text not null,
  source_document_a_id uuid not null references public.reference_documents(id),
  source_document_b_id uuid not null references public.reference_documents(id),
  conflict_summary text not null,
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED','DISMISSED')),
  detected_by uuid references public.users(id),
  detected_at timestamptz not null default now(),
  unique(id,organization_id),
  check (source_document_a_id <> source_document_b_id)
);

create table public.source_conflict_resolutions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conflict_id uuid not null,
  resolution text not null,
  selected_source_document_id uuid references public.reference_documents(id),
  resolved_by uuid not null references public.users(id),
  resolved_at timestamptz not null default now(),
  unique(conflict_id),
  foreign key(conflict_id,organization_id) references public.source_conflicts(id,organization_id) on delete cascade
);

create table public.organization_ai_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  external_ai_enabled boolean not null default false,
  privacy_approved boolean not null default false,
  provider text,
  processing_region text,
  retention_policy text,
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  check (external_ai_enabled=false or (privacy_approved=true and provider is not null and processing_region is not null))
);

insert into public.organization_ai_settings(organization_id)
select id from public.organizations
on conflict(organization_id) do nothing;

create or replace function public.bootstrap_organization_ai_settings()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.organization_ai_settings(organization_id) values(new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists organization_ai_settings_bootstrap on public.organizations;
create trigger organization_ai_settings_bootstrap
after insert on public.organizations
for each row execute function public.bootstrap_organization_ai_settings();

create table public.ai_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  review_type text not null check (review_type in ('PLANNING_ASSISTANT','PRE_REVIEW')),
  engine_type text not null check (engine_type in ('DETERMINISTIC','EXTERNAL_AI')),
  model_name text,
  provider text,
  ruleset_version text not null,
  status text not null default 'COMPLETED' check (status in ('RUNNING','COMPLETED','FAILED')),
  input_fingerprint text,
  run_by uuid not null references public.users(id),
  role_context text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(id,organization_id),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade
);

create table public.ai_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ai_review_id uuid not null,
  rule_version_id uuid references public.rule_versions(id),
  rule_code text not null,
  source_code text not null,
  source_version text not null,
  evidence_location text not null,
  status text not null check (status in ('ALIGNED','NEEDS_IMPROVEMENT','MISSING_REQUIRED_INFORMATION','MISSING_EVIDENCE','INCONSISTENT','UNREADABLE_UNCERTAIN','HUMAN_REVIEW_REQUIRED')),
  severity text not null check (severity in ('CRITICAL','MAJOR','ADVISORY')),
  rationale text not null,
  recommendation text not null,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  foreign key(ai_review_id,organization_id) references public.ai_reviews(id,organization_id) on delete cascade
);

create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null,
  suggestion_type text not null check (suggestion_type in ('GAP_STATEMENT','SMART_OBJECTIVE','BLOOM_REVIEW','DOMAIN_CLASSIFICATION','METHOD_ALIGNMENT','EVALUATION_ALIGNMENT')),
  source_text text,
  suggested_text text not null,
  status text not null default 'PROPOSED' check (status in ('PROPOSED','ACCEPTED','EDITED_ACCEPTED','REJECTED')),
  generated_by_review_id uuid,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique(id,organization_id),
  foreign key(activity_id,organization_id) references public.activities(id,organization_id) on delete cascade,
  foreign key(generated_by_review_id,organization_id) references public.ai_reviews(id,organization_id)
);

create table public.ai_acceptance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  suggestion_id uuid not null,
  action text not null check (action in ('ACCEPT','EDIT_ACCEPT','REJECT')),
  accepted_text text,
  acted_by uuid not null references public.users(id),
  role_context text not null,
  acted_at timestamptz not null default now(),
  foreign key(suggestion_id,organization_id) references public.ai_suggestions(id,organization_id) on delete cascade
);

-- Global reference metadata only. No copyrighted source files or institution branding is embedded here.
insert into public.reference_documents(source_code,title,source_type,authority_level,version_label,status,is_global)
values
  ('SCFHS_ACTIVITY_ACCREDITATION_STANDARDS','Activity Accreditation Standards','ACCREDITATION_STANDARD',1,'2023','ACTIVE',true),
  ('CPD_EDUCATIONAL_GUIDANCE','CPD Educational Guidance','EDUCATIONAL_GUIDANCE',4,'BLOOM_SMART','ACTIVE',true),
  ('INTERNAL_READINESS_ENGINE','Internal Readiness Engine','INTERNAL_POLICY',5,'1.0','ACTIVE',true)
on conflict do nothing;

insert into public.regulatory_rules(rule_code,title,rule_scope,requirement_type,status)
values
  ('ACT-GOV-001','Activity Scientific Committee','ACTIVITY_ACCREDITATION','REQUIRED','ACTIVE'),
  ('ACT-NEED-001','Learning Need / Gap','ACTIVITY_ACCREDITATION','REQUIRED','ACTIVE'),
  ('ACT-OBJ-001','Learning Objectives Present','ACTIVITY_ACCREDITATION','REQUIRED','ACTIVE'),
  ('ACT-OBJ-002','Measurable Objective Wording','EDUCATIONAL_GUIDANCE','GUIDANCE','ACTIVE'),
  ('ACT-METHOD-001','Learning Methods','ACTIVITY_ACCREDITATION','REQUIRED','ACTIVE'),
  ('ACT-EVAL-001','Evaluation Method','ACTIVITY_ACCREDITATION','REQUIRED','ACTIVE'),
  ('ACT-SPK-001','Speaker Information','ACTIVITY_ACCREDITATION','REQUIRED','ACTIVE'),
  ('ACT-SPK-002','Speaker CV Evidence','ACTIVITY_ACCREDITATION','REQUIRED','ACTIVE'),
  ('ACT-COI-001','Disclosure Evidence','ACTIVITY_ACCREDITATION','REQUIRED','ACTIVE'),
  ('ACT-COI-002','Disclosure Human Review','ACTIVITY_ACCREDITATION','REQUIRED','ACTIVE')
on conflict do nothing;

insert into public.rule_versions(rule_id,source_document_id,version_label,requirement_summary,evidence_expected,ai_check_supported,human_confirmation_required,status)
select r.id,d.id,'1.0',
  case r.rule_code
    when 'ACT-GOV-001' then 'Activity scientific committee record includes at least two members.'
    when 'ACT-NEED-001' then 'Learning need or gap is documented and reflected in planning.'
    when 'ACT-OBJ-001' then 'Learning objectives are documented.'
    when 'ACT-OBJ-002' then 'Objectives use measurable action-oriented wording.'
    when 'ACT-METHOD-001' then 'Learning methods are documented and should align to objectives.'
    when 'ACT-EVAL-001' then 'Evaluation method is documented and should align to objectives.'
    when 'ACT-SPK-001' then 'Speaker or trainer information is documented.'
    when 'ACT-SPK-002' then 'Speaker qualifications/CV evidence is available for review.'
    when 'ACT-COI-001' then 'Disclosure/conflict-of-interest evidence is available for relevant persons.'
    when 'ACT-COI-002' then 'Pending disclosure records require human review.'
  end,
  case r.rule_code
    when 'ACT-GOV-001' then 'Activity scientific committee member records'
    when 'ACT-NEED-001' then 'Needs assessment / learning gap evidence'
    when 'ACT-OBJ-001' then 'Learning objective records'
    when 'ACT-OBJ-002' then 'Learning objective text'
    when 'ACT-METHOD-001' then 'Learning methods'
    when 'ACT-EVAL-001' then 'Evaluation method'
    when 'ACT-SPK-001' then 'Speaker records'
    when 'ACT-SPK-002' then 'Speaker CV or offline evidence review'
    else 'Disclosure register / evidence'
  end,
  true,true,'ACTIVE'
from public.regulatory_rules r
join public.reference_documents d on d.source_code=(case when r.rule_code='ACT-OBJ-002' then 'CPD_EDUCATIONAL_GUIDANCE' else 'SCFHS_ACTIVITY_ACCREDITATION_STANDARDS' end)
where r.organization_id is null and d.organization_id is null
on conflict(rule_id,version_label) do nothing;

-- RLS for global/org reference metadata and tenant review data.
alter table public.reference_documents enable row level security;
alter table public.regulatory_rules enable row level security;
alter table public.rule_versions enable row level security;
alter table public.source_conflicts enable row level security;
alter table public.source_conflict_resolutions enable row level security;
alter table public.organization_ai_settings enable row level security;
alter table public.ai_reviews enable row level security;
alter table public.ai_findings enable row level security;
alter table public.ai_suggestions enable row level security;
alter table public.ai_acceptance_events enable row level security;

create policy reference_documents_read on public.reference_documents for select to authenticated
using (organization_id is null or public.is_org_member(organization_id));
create policy reference_documents_org_write on public.reference_documents for all to authenticated
using (organization_id is not null and public.current_user_has_permission(organization_id,'ai.manage_references'))
with check (organization_id is not null and public.current_user_has_permission(organization_id,'ai.manage_references'));

create policy regulatory_rules_read on public.regulatory_rules for select to authenticated
using (organization_id is null or public.is_org_member(organization_id));
create policy regulatory_rules_org_write on public.regulatory_rules for all to authenticated
using (organization_id is not null and public.current_user_has_permission(organization_id,'ai.manage_references'))
with check (organization_id is not null and public.current_user_has_permission(organization_id,'ai.manage_references'));

create policy rule_versions_read on public.rule_versions for select to authenticated
using (organization_id is null or public.is_org_member(organization_id));
create policy rule_versions_org_write on public.rule_versions for all to authenticated
using (organization_id is not null and public.current_user_has_permission(organization_id,'ai.manage_references'))
with check (organization_id is not null and public.current_user_has_permission(organization_id,'ai.manage_references'));

create policy source_conflicts_read on public.source_conflicts for select to authenticated using(public.is_org_member(organization_id));
create policy source_conflicts_write on public.source_conflicts for all to authenticated
using(public.current_user_has_permission(organization_id,'ai.manage_references'))
with check(public.current_user_has_permission(organization_id,'ai.manage_references'));
create policy source_conflict_resolutions_read on public.source_conflict_resolutions for select to authenticated using(public.is_org_member(organization_id));
create policy source_conflict_resolutions_write on public.source_conflict_resolutions for all to authenticated
using(public.current_user_has_permission(organization_id,'ai.resolve_source_conflict'))
with check(public.current_user_has_permission(organization_id,'ai.resolve_source_conflict'));

create policy organization_ai_settings_read on public.organization_ai_settings for select to authenticated using(public.is_org_member(organization_id));
create policy organization_ai_settings_write on public.organization_ai_settings for update to authenticated
using(public.current_user_has_permission(organization_id,'system.settings.manage'))
with check(public.current_user_has_permission(organization_id,'system.settings.manage'));

create policy ai_reviews_read on public.ai_reviews for select to authenticated
using(exists(select 1 from public.activities a where a.id=activity_id and a.organization_id=organization_id));
create policy ai_findings_read on public.ai_findings for select to authenticated using(public.is_org_member(organization_id));
create policy ai_suggestions_read on public.ai_suggestions for select to authenticated
using(exists(select 1 from public.activities a where a.id=activity_id and a.organization_id=organization_id));
create policy ai_acceptance_events_read on public.ai_acceptance_events for select to authenticated using(public.is_org_member(organization_id));

-- Reviews/findings are inserted through the governed command only.
grant select on public.reference_documents,public.regulatory_rules,public.rule_versions,public.source_conflicts,public.source_conflict_resolutions,
  public.organization_ai_settings,public.ai_reviews,public.ai_findings,public.ai_suggestions,public.ai_acceptance_events to authenticated;
grant insert,update,delete on public.reference_documents,public.regulatory_rules,public.rule_versions,public.source_conflicts to authenticated;
grant insert on public.source_conflict_resolutions to authenticated;
grant update on public.organization_ai_settings to authenticated;

create or replace function public.save_pre_review_command(
  p_organization_id uuid,
  p_role_context text,
  p_activity_id uuid,
  p_ruleset_version text,
  p_input_fingerprint text,
  p_findings jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor uuid:=auth.uid();
  v_review_id uuid;
  v_finding jsonb;
  v_rule_version_id uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'ai.run_prereview') then
    raise exception using errcode='42501',message='Active role context cannot run pre-review.';
  end if;
  if not exists(select 1 from public.activities a where a.id=p_activity_id and a.organization_id=p_organization_id) then
    raise exception using errcode='42501',message='Activity is not visible in this organization.';
  end if;

  insert into public.ai_reviews(
    organization_id,activity_id,review_type,engine_type,ruleset_version,input_fingerprint,run_by,role_context,status,completed_at
  ) values(
    p_organization_id,p_activity_id,'PRE_REVIEW','DETERMINISTIC',p_ruleset_version,p_input_fingerprint,v_actor,p_role_context,'COMPLETED',now()
  ) returning id into v_review_id;

  for v_finding in select * from jsonb_array_elements(coalesce(p_findings,'[]'::jsonb)) loop
    select rv.id into v_rule_version_id
    from public.regulatory_rules r
    join public.rule_versions rv on rv.rule_id=r.id and rv.status='ACTIVE'
    where r.rule_code=v_finding->>'ruleCode' and r.organization_id is null
    order by rv.created_at desc limit 1;

    insert into public.ai_findings(
      organization_id,ai_review_id,rule_version_id,rule_code,source_code,source_version,evidence_location,status,severity,rationale,recommendation,confidence
    ) values(
      p_organization_id,v_review_id,v_rule_version_id,v_finding->>'ruleCode',v_finding->>'sourceCode',v_finding->>'sourceVersion',
      v_finding->>'evidenceLocation',v_finding->>'status',v_finding->>'severity',v_finding->>'rationale',v_finding->>'recommendation',
      coalesce((v_finding->>'confidence')::numeric,1)
    );
  end loop;

  perform public.log_audit_event(
    p_organization_id,v_actor,p_role_context,'activity.pre_review_completed','activity',p_activity_id,null,
    jsonb_build_object('ai_review_id',v_review_id,'engine','DETERMINISTIC','ruleset_version',p_ruleset_version,'finding_count',jsonb_array_length(coalesce(p_findings,'[]'::jsonb))),
    null,null,null
  );
  return v_review_id;
end;
$$;
revoke all on function public.save_pre_review_command(uuid,text,uuid,text,text,jsonb) from public;
grant execute on function public.save_pre_review_command(uuid,text,uuid,text,text,jsonb) to authenticated;

create or replace function public.record_ai_suggestion_decision_command(
  p_organization_id uuid,
  p_role_context text,
  p_suggestion_id uuid,
  p_action text,
  p_accepted_text text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor uuid:=auth.uid();
  v_activity_id uuid;
  v_status text;
begin
  select activity_id into v_activity_id from public.ai_suggestions where id=p_suggestion_id and organization_id=p_organization_id;
  if v_activity_id is null then raise exception 'Suggestion not found'; end if;
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'activity.fill_submit') then
    raise exception using errcode='42501',message='Active role context cannot decide planning suggestions.';
  end if;
  if not (public.current_role_has_permission(p_organization_id,p_role_context,'activity.view.all') or public.current_user_is_assigned_activity(v_activity_id)) then
    raise exception using errcode='42501',message='User is not authorized for this activity.';
  end if;
  v_status:=case p_action when 'ACCEPT' then 'ACCEPTED' when 'EDIT_ACCEPT' then 'EDITED_ACCEPTED' when 'REJECT' then 'REJECTED' else null end;
  if v_status is null then raise exception 'Invalid suggestion action'; end if;
  update public.ai_suggestions set status=v_status where id=p_suggestion_id;
  insert into public.ai_acceptance_events(organization_id,suggestion_id,action,accepted_text,acted_by,role_context)
  values(p_organization_id,p_suggestion_id,p_action,p_accepted_text,v_actor,p_role_context);
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'activity.ai_suggestion_decision','activity',v_activity_id,null,
    jsonb_build_object('suggestion_id',p_suggestion_id,'action',p_action),null,null,null);
end;
$$;
revoke all on function public.record_ai_suggestion_decision_command(uuid,text,uuid,text,text) from public;
grant execute on function public.record_ai_suggestion_decision_command(uuid,text,uuid,text,text) to authenticated;
