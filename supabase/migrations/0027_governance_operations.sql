-- Phase 8 governance operations: in-app notifications, template lifecycle and evidence-readiness view.

insert into public.permissions(code,description) values
  ('notification.view','View in-app governance notifications'),
  ('notification.manage','Configure and refresh organization notification rules'),
  ('template.manage','Create template and mapping drafts'),
  ('template.approve','Activate an approved template version'),
  ('evidence.readiness.view','View evidence completeness/readiness dashboard')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('ORGANIZATION_SYSTEM_ADMIN','ACTIVITY_OFFICER','COMMITTEE_SECRETARY','COMMITTEE_CHAIR','COMMITTEE_MEMBER','MANAGEMENT_VIEWER','MANAGEMENT_APPROVER','AUDITOR') and p.code='notification.view' on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where r.code='ORGANIZATION_SYSTEM_ADMIN' and p.code in ('notification.manage','template.manage') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where r.code='MANAGEMENT_APPROVER' and p.code='template.approve' on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('ORGANIZATION_SYSTEM_ADMIN','ACTIVITY_OFFICER','COMMITTEE_SECRETARY','COMMITTEE_CHAIR','MANAGEMENT_VIEWER','MANAGEMENT_APPROVER','AUDITOR') and p.code='evidence.readiness.view' on conflict do nothing;

create table public.notification_rules (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  event_code text not null, enabled boolean not null default true, in_app_enabled boolean not null default true, email_enabled boolean not null default false,
  lead_days integer, escalation_days integer, config_json jsonb not null default '{}'::jsonb,
  updated_by uuid not null references public.users(id), updated_at timestamptz not null default now(), unique(organization_id,event_code), unique(id,organization_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_user_id uuid not null references public.users(id) on delete cascade, event_key text not null, event_code text not null,
  severity text not null default 'INFO' check(severity in ('INFO','WARNING','CRITICAL')), title text not null, body text not null,
  entity_type text, entity_id uuid, is_read boolean not null default false, created_at timestamptz not null default now(), read_at timestamptz,
  unique(organization_id,recipient_user_id,event_key)
);
create index notifications_recipient_idx on public.notifications(recipient_user_id,is_read,created_at desc);

create table public.notification_preferences (
  organization_id uuid not null references public.organizations(id) on delete cascade, user_id uuid not null references public.users(id) on delete cascade,
  in_app_enabled boolean not null default true, email_enabled boolean not null default false, updated_at timestamptz not null default now(),
  primary key(organization_id,user_id)
);

create table public.notification_delivery_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade, channel text not null check(channel in ('IN_APP','EMAIL')),
  status text not null check(status in ('CREATED','SENT','FAILED','SKIPPED')), detail text, occurred_at timestamptz not null default now()
);

create table public.document_templates (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  template_code text not null, template_family text not null check(template_family in ('OFFICIAL_EXTERNAL_FORM','INTERNAL_GOVERNANCE','REPORT')),
  name_ar text not null, name_en text, created_by uuid not null references public.users(id), created_at timestamptz not null default now(),
  unique(organization_id,template_code), unique(id,organization_id)
);

create table public.template_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null, version_label text not null, status text not null default 'DRAFT' check(status in ('DRAFT','ACTIVE','SUPERSEDED','EXPIRED')),
  effective_from date, effective_to date, source_reference text, storage_path text, checksum text not null,
  visual_qa_status text not null default 'PENDING' check(visual_qa_status in ('PENDING','PASSED','FAILED')),
  created_by uuid not null references public.users(id), approved_by uuid references public.users(id), approved_at timestamptz, created_at timestamptz not null default now(),
  unique(template_id,version_label), unique(id,organization_id), foreign key(template_id,organization_id) references public.document_templates(id,organization_id) on delete cascade,
  check(effective_to is null or effective_from is null or effective_to>=effective_from)
);
create unique index template_one_active_version on public.template_versions(template_id) where status='ACTIVE';

create table public.template_mapping_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  template_version_id uuid not null, mapping_version text not null, field_mappings jsonb not null default '[]'::jsonb,
  regression_test_status text not null default 'PENDING' check(regression_test_status in ('PENDING','PASSED','FAILED')),
  created_by uuid not null references public.users(id), created_at timestamptz not null default now(),
  unique(template_version_id,mapping_version), foreign key(template_version_id,organization_id) references public.template_versions(id,organization_id) on delete cascade
);

alter table public.notification_rules enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_delivery_events enable row level security;
alter table public.document_templates enable row level security;
alter table public.template_versions enable row level security;
alter table public.template_mapping_versions enable row level security;
create policy notification_rules_read on public.notification_rules for select to authenticated using(public.is_org_member(organization_id));
create policy notifications_read_self on public.notifications for select to authenticated using(public.is_org_member(organization_id) and recipient_user_id=auth.uid());
create policy notification_preferences_self on public.notification_preferences for select to authenticated using(public.is_org_member(organization_id) and user_id=auth.uid());
create policy notification_delivery_self on public.notification_delivery_events for select to authenticated using(exists(select 1 from public.notifications n where n.id=notification_id and n.recipient_user_id=auth.uid()));
create policy templates_read on public.document_templates for select to authenticated using(public.is_org_member(organization_id));
create policy template_versions_read on public.template_versions for select to authenticated using(public.is_org_member(organization_id));
create policy mappings_read on public.template_mapping_versions for select to authenticated using(public.is_org_member(organization_id));
grant select on public.notification_rules,public.notifications,public.notification_preferences,public.notification_delivery_events,public.document_templates,public.template_versions,public.template_mapping_versions to authenticated;

create or replace view public.activity_evidence_readiness with (security_invoker=true) as
select
  a.id activity_id,a.organization_id,a.activity_code,a.title_ar,a.internal_state,
  exists(select 1 from public.activity_intake_profiles p where p.activity_id=a.id and p.form_status='CONFIRMED') as activity_form_ready,
  (select count(*) from public.activity_scientific_committee_members m join public.activity_scientific_committees c on c.id=m.activity_scientific_committee_id where c.activity_id=a.id)>=2 as activity_scientific_committee_ready,
  exists(select 1 from public.activity_speakers s where s.activity_id=a.id) as speakers_ready,
  exists(select 1 from public.activity_speaker_documents d join public.activity_speakers s on s.id=d.activity_speaker_id where s.activity_id=a.id and d.document_type='CV') as cv_evidence_available,
  exists(select 1 from public.disclosure_records d where d.activity_id=a.id) as disclosure_recorded,
  exists(select 1 from public.committee_decisions d where d.activity_id=a.id) as committee_decision_recorded,
  exists(select 1 from public.committee_minutes m where m.activity_id=a.id and m.status='FINAL') as final_minutes_available,
  exists(select 1 from public.external_submission_records e where e.activity_id=a.id and e.status='APPROVED' and e.evidence_reference is not null) as external_decision_evidence_available,
  exists(select 1 from public.impact_reports r where r.activity_id=a.id and r.kind='FINAL' and r.status='FINAL') as final_impact_report_available,
  (select count(*) from public.activity_evidence e where e.activity_id=a.id and e.status='MISSING') as missing_evidence_count
from public.activities a;
grant select on public.activity_evidence_readiness to authenticated;

create or replace function public.configure_notification_rule_command(p_organization_id uuid,p_role_context text,p_event_code text,p_enabled boolean,p_email_enabled boolean,p_lead_days integer,p_escalation_days integer,p_config jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'notification.manage') then raise exception using errcode='42501',message='Not authorized'; end if;
  insert into public.notification_rules(organization_id,event_code,enabled,in_app_enabled,email_enabled,lead_days,escalation_days,config_json,updated_by)
  values(p_organization_id,p_event_code,p_enabled,true,p_email_enabled,p_lead_days,p_escalation_days,coalesce(p_config,'{}'::jsonb),v_actor)
  on conflict(organization_id,event_code) do update set enabled=excluded.enabled,email_enabled=excluded.email_enabled,lead_days=excluded.lead_days,escalation_days=excluded.escalation_days,config_json=excluded.config_json,updated_by=v_actor,updated_at=now()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.configure_notification_rule_command(uuid,text,text,boolean,boolean,integer,integer,jsonb) from public;
grant execute on function public.configure_notification_rule_command(uuid,text,text,boolean,boolean,integer,integer,jsonb) to authenticated;

create or replace function public.refresh_governance_notifications_command(p_organization_id uuid,p_role_context text)
returns integer language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_count int:=0; v record; v_user uuid;
begin
  if v_actor is null or not public.is_org_member(p_organization_id) then raise exception using errcode='42501',message='Not an organization member'; end if;
  perform public.refresh_impact_schedule_statuses(p_organization_id,null);
  for v in
    select s.*,a.activity_code,a.title_ar,aa.membership_id from public.activity_impact_schedules s join public.activities a on a.id=s.activity_id
    left join public.activity_assignments aa on aa.activity_id=a.id and aa.is_active=true
    where s.organization_id=p_organization_id and s.status in ('DUE','OVERDUE')
  loop
    select m.user_id into v_user from public.organization_memberships m where m.id=v.membership_id;
    if v_user is not null then
      insert into public.notifications(organization_id,recipient_user_id,event_key,event_code,severity,title,body,entity_type,entity_id)
      values(p_organization_id,v_user,'impact:'||v.id||':'||v.status,case when v.status='OVERDUE' then 'IMPACT_OVERDUE' else 'IMPACT_DUE' end,case when v.status='OVERDUE' then 'WARNING' else 'INFO' end,
        case when v.status='OVERDUE' then 'متابعة أثر متأخرة' else 'متابعة أثر مستحقة' end,v.activity_code||' · '||v.title_ar||' · '||v.level,'activity',v.activity_id)
      on conflict(organization_id,recipient_user_id,event_key) do nothing;
      if found then v_count:=v_count+1; end if;
    end if;
  end loop;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'notification.refresh','organization',p_organization_id,null,jsonb_build_object('created',v_count),null,null,null);
  return v_count;
end $$;
revoke all on function public.refresh_governance_notifications_command(uuid,text) from public;
grant execute on function public.refresh_governance_notifications_command(uuid,text) to authenticated;

create or replace function public.create_template_version_command(p_organization_id uuid,p_role_context text,p_template_code text,p_family text,p_name_ar text,p_name_en text,p_version text,p_source_reference text,p_storage_path text,p_checksum text,p_mapping jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_template uuid; v_version uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'template.manage') then raise exception using errcode='42501',message='Not authorized to manage templates'; end if;
  insert into public.document_templates(organization_id,template_code,template_family,name_ar,name_en,created_by) values(p_organization_id,p_template_code,p_family,p_name_ar,p_name_en,v_actor)
  on conflict(organization_id,template_code) do update set name_ar=excluded.name_ar,name_en=excluded.name_en returning id into v_template;
  insert into public.template_versions(organization_id,template_id,version_label,status,source_reference,storage_path,checksum,visual_qa_status,created_by)
  values(p_organization_id,v_template,p_version,'DRAFT',p_source_reference,p_storage_path,p_checksum,'PENDING',v_actor) returning id into v_version;
  insert into public.template_mapping_versions(organization_id,template_version_id,mapping_version,field_mappings,created_by) values(p_organization_id,v_version,'1',coalesce(p_mapping,'[]'::jsonb),v_actor);
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'template.version_created','template_version',v_version,null,jsonb_build_object('template_code',p_template_code,'version',p_version,'checksum',p_checksum),null,null,null);
  return v_version;
end $$;
revoke all on function public.create_template_version_command(uuid,text,text,text,text,text,text,text,text,text,jsonb) from public;
grant execute on function public.create_template_version_command(uuid,text,text,text,text,text,text,text,text,text,jsonb) to authenticated;

create or replace function public.mark_template_qa_command(p_organization_id uuid,p_role_context text,p_template_version_id uuid,p_visual_qa text,p_regression_qa text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'template.manage') then raise exception using errcode='42501',message='Not authorized'; end if;
  if p_visual_qa not in ('PASSED','FAILED') or p_regression_qa not in ('PASSED','FAILED') then raise exception using errcode='22023',message='QA status must be PASSED or FAILED'; end if;
  update public.template_versions set visual_qa_status=p_visual_qa where id=p_template_version_id and organization_id=p_organization_id;
  update public.template_mapping_versions set regression_test_status=p_regression_qa where template_version_id=p_template_version_id and organization_id=p_organization_id;
end $$;
revoke all on function public.mark_template_qa_command(uuid,text,uuid,text,text) from public;
grant execute on function public.mark_template_qa_command(uuid,text,uuid,text,text) to authenticated;

create or replace function public.activate_template_version_command(p_organization_id uuid,p_role_context text,p_template_version_id uuid,p_effective_from date)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_template uuid;
begin
  if v_actor is null or not public.current_role_has_permission(p_organization_id,p_role_context,'template.approve') then raise exception using errcode='42501',message='Management approval required to activate template'; end if;
  select template_id into v_template from public.template_versions v where v.id=p_template_version_id and v.organization_id=p_organization_id and v.status='DRAFT' and v.visual_qa_status='PASSED' and exists(select 1 from public.template_mapping_versions m where m.template_version_id=v.id and m.regression_test_status='PASSED');
  if v_template is null then raise exception using errcode='22023',message='Template must pass visual and mapping regression QA before activation'; end if;
  update public.template_versions set status='SUPERSEDED',effective_to=p_effective_from-1 where template_id=v_template and status='ACTIVE';
  update public.template_versions set status='ACTIVE',effective_from=p_effective_from,approved_by=v_actor,approved_at=now() where id=p_template_version_id;
  perform public.log_audit_event(p_organization_id,v_actor,p_role_context,'template.version_activated','template_version',p_template_version_id,null,jsonb_build_object('effective_from',p_effective_from),null,null,null);
end $$;
revoke all on function public.activate_template_version_command(uuid,text,uuid,date) from public;
grant execute on function public.activate_template_version_command(uuid,text,uuid,date) to authenticated;
