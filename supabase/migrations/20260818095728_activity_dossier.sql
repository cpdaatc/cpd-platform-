-- Unified, activity-scoped accreditation dossier.
-- Binary objects remain in the private Storage bucket. These functions expose
-- metadata only and resolve a storage path only after a second authorization
-- check at download time.

alter table public.activity_evidence
  add column if not exists original_filename text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists version_no integer not null default 1,
  add column if not exists supersedes_evidence_id uuid;

alter table public.activity_evidence
  drop constraint if exists activity_evidence_file_size_nonnegative,
  add constraint activity_evidence_file_size_nonnegative
    check (file_size_bytes is null or file_size_bytes >= 0),
  drop constraint if exists activity_evidence_version_positive,
  add constraint activity_evidence_version_positive check (version_no > 0),
  drop constraint if exists activity_evidence_supersedes_fk,
  add constraint activity_evidence_supersedes_fk
    foreign key (supersedes_evidence_id, organization_id)
    references public.activity_evidence(id, organization_id);

create index if not exists activities_dossier_filter_idx
  on public.activities(organization_id, reporting_year, department_id, updated_at desc);
create index if not exists activity_evidence_dossier_idx
  on public.activity_evidence(organization_id, activity_id, evidence_type, version_no desc);
create index if not exists intake_documents_dossier_idx
  on public.intake_documents(organization_id, activity_id, uploaded_at desc);
create index if not exists committee_decisions_dossier_idx
  on public.committee_decisions(organization_id, activity_id, decided_at desc);
create index if not exists committee_minutes_dossier_idx
  on public.committee_minutes(organization_id, activity_id, status, version_no desc);
create index if not exists impact_reports_dossier_idx
  on public.impact_reports(organization_id, activity_id, kind, status, version_no desc);

create or replace function public.current_user_can_access_activity_resource(
  p_organization_id uuid,
  p_activity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.activities a
    where a.id = p_activity_id
      and a.organization_id = p_organization_id
      and (
        public.current_user_has_permission(p_organization_id, 'activity.view.all')
        or (
          public.current_user_has_permission(p_organization_id, 'activity.view.assigned')
          and public.current_user_is_assigned_activity(p_activity_id)
        )
      )
  );
$$;
revoke all on function public.current_user_can_access_activity_resource(uuid,uuid)
  from public, anon;
grant execute on function public.current_user_can_access_activity_resource(uuid,uuid)
  to authenticated, service_role;

create or replace function public.current_role_can_access_activity_resource(
  p_organization_id uuid,
  p_role_context text,
  p_activity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.activities a
    where a.id = p_activity_id
      and a.organization_id = p_organization_id
      and (
        public.current_role_has_permission(p_organization_id, p_role_context, 'activity.view.all')
        or (
          public.current_role_has_permission(p_organization_id, p_role_context, 'activity.view.assigned')
          and public.current_user_is_assigned_activity(p_activity_id)
        )
      )
  );
$$;
revoke all on function public.current_role_can_access_activity_resource(uuid,text,uuid)
  from public, anon;
grant execute on function public.current_role_can_access_activity_resource(uuid,text,uuid)
  to authenticated, service_role;

-- Activity Officer impact reads are assignment scoped. Organization-wide roles
-- retain access through activity.view.all.
drop policy if exists impact_schedule_read on public.activity_impact_schedules;
drop policy if exists impact_level_read on public.impact_level_results;
drop policy if exists impact_objective_read on public.impact_objectives;
drop policy if exists impact_reports_read on public.impact_reports;
drop policy if exists impact_corrections_read on public.impact_correction_requests;
create policy impact_schedule_read on public.activity_impact_schedules
for select to authenticated using (
  public.current_user_has_permission(organization_id, 'impact.view')
  and public.current_user_can_access_activity_resource(organization_id, activity_id)
);
create policy impact_level_read on public.impact_level_results
for select to authenticated using (
  public.current_user_has_permission(organization_id, 'impact.view')
  and public.current_user_can_access_activity_resource(organization_id, activity_id)
);
create policy impact_objective_read on public.impact_objectives
for select to authenticated using (
  public.current_user_has_permission(organization_id, 'impact.view')
  and public.current_user_can_access_activity_resource(organization_id, activity_id)
);
create policy impact_reports_read on public.impact_reports
for select to authenticated using (
  public.current_user_has_permission(organization_id, 'impact.view')
  and public.current_user_can_access_activity_resource(organization_id, activity_id)
);
create policy impact_corrections_read on public.impact_correction_requests
for select to authenticated using (
  public.current_user_has_permission(organization_id, 'impact.view')
  and public.current_user_can_access_activity_resource(organization_id, activity_id)
);

-- Committee members keep their existing organization-wide read. An assigned
-- Activity Officer receives read-only access to the decision and final minutes
-- for that activity; write/finalization commands are unchanged.
drop policy if exists committee_decisions_read on public.committee_decisions;
drop policy if exists committee_minutes_read on public.committee_minutes;
create policy committee_decisions_read on public.committee_decisions
for select to authenticated using (
  public.current_user_can_read_committee(organization_id)
  or (
    public.current_user_has_permission(organization_id, 'activity.view.assigned')
    and public.current_user_is_assigned_activity(activity_id)
  )
);
create policy committee_minutes_read on public.committee_minutes
for select to authenticated using (
  public.current_user_can_read_committee(organization_id)
  or (
    public.current_user_has_permission(organization_id, 'activity.view.assigned')
    and public.current_user_is_assigned_activity(activity_id)
  )
);

create or replace function public.register_activity_attachment_command(
  p_organization_id uuid,
  p_role_context text,
  p_activity_id uuid,
  p_evidence_type text,
  p_storage_path text,
  p_sha256 text,
  p_original_filename text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_version integer;
  v_previous uuid;
begin
  if v_actor is null
     or not public.current_role_has_permission(
       p_organization_id, p_role_context, 'activity.fill_submit'
     )
     or not public.current_role_can_access_activity_resource(
       p_organization_id, p_role_context, p_activity_id
     ) then
    raise exception using errcode='42501', message='Activity is not available';
  end if;
  if nullif(btrim(p_evidence_type), '') is null
     or nullif(btrim(p_original_filename), '') is null
     or nullif(btrim(p_storage_path), '') is null
     or p_sha256 !~ '^[0-9a-fA-F]{64}$'
     or p_file_size_bytes <= 0 then
    raise exception using errcode='22023', message='Attachment metadata is invalid';
  end if;
  if p_mime_type not in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ) then
    raise exception using errcode='22023', message='Attachment type is not allowed';
  end if;
  if p_storage_path not like (p_organization_id::text || '/%')
     or position('..' in p_storage_path) > 0 then
    raise exception using errcode='22023', message='Attachment path is invalid';
  end if;

  select e.id, e.version_no
    into v_previous, v_version
  from public.activity_evidence e
  where e.organization_id = p_organization_id
    and e.activity_id = p_activity_id
    and e.evidence_type = p_evidence_type
    and e.status = 'UPLOADED'
  order by e.version_no desc, e.created_at desc
  limit 1;
  v_version := coalesce(v_version, 0) + 1;

  insert into public.activity_evidence(
    organization_id, activity_id, evidence_type, status, storage_path,
    sha256, notes, created_by, original_filename, mime_type,
    file_size_bytes, version_no, supersedes_evidence_id
  ) values (
    p_organization_id, p_activity_id, btrim(p_evidence_type), 'UPLOADED',
    p_storage_path, lower(p_sha256), nullif(btrim(p_notes), ''), v_actor,
    btrim(p_original_filename), p_mime_type, p_file_size_bytes,
    v_version, v_previous
  ) returning id into v_id;

  perform public.log_audit_event(
    p_organization_id, v_actor, p_role_context,
    'activity.attachment_uploaded', 'activity', p_activity_id,
    null,
    jsonb_build_object(
      'evidence_id', v_id,
      'evidence_type', p_evidence_type,
      'version', v_version,
      'sha256', lower(p_sha256),
      'original_filename', p_original_filename
    ),
    null, null, null
  );
  return v_id;
end;
$$;
revoke all on function public.register_activity_attachment_command(
  uuid,text,uuid,text,text,text,text,text,bigint,text
) from public, anon;
grant execute on function public.register_activity_attachment_command(
  uuid,text,uuid,text,text,text,text,text,bigint,text
) to authenticated;

create or replace function public.list_activity_dossiers_command(
  p_organization_id uuid,
  p_role_context text,
  p_reporting_year integer default null,
  p_department_id uuid default null,
  p_search text default null
)
returns table (
  id uuid,
  activity_code text,
  title_ar text,
  title_en text,
  department_id uuid,
  department_name_ar text,
  department_name_en text,
  reporting_year integer,
  planned_start_date date,
  internal_state text,
  committee_decision text,
  external_state text,
  impact_state text,
  committee_complete integer,
  committee_missing integer,
  post_activity_complete integer,
  post_activity_missing integer,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (
    public.current_role_has_permission(p_organization_id, p_role_context, 'activity.view.all')
    or public.current_role_has_permission(p_organization_id, p_role_context, 'activity.view.assigned')
  ) then
    raise exception using errcode='42501', message='Active role cannot list activities';
  end if;

  return query
  select
    a.id, a.activity_code, a.title_ar, a.title_en,
    d.id, d.name_ar, d.name_en,
    a.reporting_year, a.planned_start_date, a.internal_state,
    decision.decision,
    external_record.status,
    impact.status,
    (
      (case when readiness.activity_form_ready then 1 else 0 end)
      + (case when readiness.activity_scientific_committee_ready then 1 else 0 end)
      + (case when readiness.speakers_ready then 1 else 0 end)
      + (case when readiness.cv_evidence_available then 1 else 0 end)
      + (case when readiness.disclosure_recorded then 1 else 0 end)
    )::integer,
    (
      5 - (case when readiness.activity_form_ready then 1 else 0 end)
        - (case when readiness.activity_scientific_committee_ready then 1 else 0 end)
        - (case when readiness.speakers_ready then 1 else 0 end)
        - (case when readiness.cv_evidence_available then 1 else 0 end)
        - (case when readiness.disclosure_recorded then 1 else 0 end)
    )::integer,
    (case when readiness.final_impact_report_available then 1 else 0 end)::integer,
    (case when readiness.final_impact_report_available then 0 else 1 end)::integer,
    a.updated_at
  from public.activities a
  left join public.departments d
    on d.id = a.department_id and d.organization_id = a.organization_id
  left join public.activity_evidence_readiness readiness
    on readiness.activity_id = a.id and readiness.organization_id = a.organization_id
  left join lateral (
    select cd.decision
    from public.committee_decisions cd
    where cd.organization_id = a.organization_id and cd.activity_id = a.id
    order by cd.decided_at desc
    limit 1
  ) decision on true
  left join lateral (
    select esr.status
    from public.external_submission_records esr
    where esr.organization_id = a.organization_id and esr.activity_id = a.id
    order by esr.updated_at desc
    limit 1
  ) external_record on true
  left join lateral (
    select ir.status
    from public.impact_reports ir
    where ir.organization_id = a.organization_id and ir.activity_id = a.id
    order by (ir.kind = 'FINAL') desc, ir.version_no desc
    limit 1
  ) impact on true
  where a.organization_id = p_organization_id
    and public.current_role_can_access_activity_resource(
      p_organization_id, p_role_context, a.id
    )
    and (p_reporting_year is null or a.reporting_year = p_reporting_year)
    and (p_department_id is null or a.department_id = p_department_id)
    and (
      nullif(btrim(coalesce(p_search, '')), '') is null
      or a.activity_code ilike '%' || btrim(p_search) || '%'
      or a.title_ar ilike '%' || btrim(p_search) || '%'
      or coalesce(a.title_en, '') ilike '%' || btrim(p_search) || '%'
    )
  order by a.reporting_year desc, a.planned_start_date desc nulls last,
    a.activity_code;
end;
$$;
revoke all on function public.list_activity_dossiers_command(uuid,text,integer,uuid,text)
  from public, anon;
grant execute on function public.list_activity_dossiers_command(uuid,text,integer,uuid,text)
  to authenticated;

create or replace function public.get_activity_dossier_command(
  p_organization_id uuid,
  p_role_context text,
  p_activity_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.current_role_can_access_activity_resource(
    p_organization_id, p_role_context, p_activity_id
  ) then
    raise exception using errcode='42501', message='Activity is not available';
  end if;

  select jsonb_build_object(
    'contractVersion', 1,
    'activity', jsonb_build_object(
      'id', row.id,
      'activityCode', row.activity_code,
      'titleAr', row.title_ar,
      'titleEn', row.title_en,
      'department', jsonb_build_object(
        'id', row.department_id,
        'nameAr', row.department_name_ar,
        'nameEn', row.department_name_en
      ),
      'reportingYear', row.reporting_year,
      'plannedStartDate', row.planned_start_date,
      'internalState', row.internal_state,
      'committeeDecision', row.committee_decision,
      'externalState', row.external_state,
      'impactState', row.impact_state,
      'committeeComplete', row.committee_complete,
      'committeeMissing', row.committee_missing,
      'postActivityComplete', row.post_activity_complete,
      'postActivityMissing', row.post_activity_missing,
      'updatedAt', row.updated_at
    ),
    'assignedOfficer', (
      select jsonb_build_object(
        'membershipId', m.id,
        'displayName', coalesce(u.display_name, '—')
      )
      from public.activity_assignments aa
      join public.organization_memberships m
        on m.id = aa.membership_id and m.organization_id = aa.organization_id
      join public.users u on u.id = m.user_id
      where aa.organization_id = p_organization_id
        and aa.activity_id = p_activity_id
        and aa.is_active
      order by aa.assigned_at desc
      limit 1
    ),
    'requirements', jsonb_build_array(
      jsonb_build_object('code','OFFICIAL_FORM','labelAr','النموذج الرسمي','requiredFor','COMMITTEE','state',case when ready.activity_form_ready then 'VERIFIED' else 'MISSING' end),
      jsonb_build_object('code','SCIENTIFIC_COMMITTEE','labelAr','اللجنة العلمية للنشاط','requiredFor','COMMITTEE','state',case when ready.activity_scientific_committee_ready then 'VERIFIED' else 'MISSING' end),
      jsonb_build_object('code','SPEAKERS','labelAr','المتحدثون','requiredFor','COMMITTEE','state',case when ready.speakers_ready then 'VERIFIED' else 'MISSING' end),
      jsonb_build_object('code','SPEAKER_CV','labelAr','السير الذاتية','requiredFor','COMMITTEE','state',case when ready.cv_evidence_available then 'VERIFIED' else 'MISSING' end),
      jsonb_build_object('code','DISCLOSURE','labelAr','الإفصاحات','requiredFor','COMMITTEE','state',case when ready.disclosure_recorded then 'VERIFIED' else 'MISSING' end),
      jsonb_build_object('code','FINAL_IMPACT','labelAr','تقرير الأثر النهائي','requiredFor','POST_ACTIVITY','state',case when ready.final_impact_report_available then 'VERIFIED' else 'MISSING' end)
    ),
    'documents', coalesce((
      select jsonb_agg(doc.document order by doc.sort_at desc)
      from (
        select i.uploaded_at sort_at, jsonb_build_object(
          'id', i.id, 'sourceKind', 'INTAKE_DOCUMENT',
          'category', 'OFFICIAL_FORM', 'filename', i.original_filename,
          'version', row_number() over(order by i.uploaded_at)::integer,
          'mimeType', i.mime_type, 'sizeBytes', i.file_size_bytes,
          'checksum', i.sha256, 'uploadedBy', i.uploaded_by,
          'uploadedAt', i.uploaded_at, 'verificationState', null,
          'locked', true
        ) document
        from public.intake_documents i
        where i.organization_id = p_organization_id
          and i.activity_id = p_activity_id
          and i.document_role = 'COMPLETED_ACTIVITY_FORM'
        union all
        select e.created_at, jsonb_build_object(
          'id', e.id, 'sourceKind', 'ACTIVITY_EVIDENCE',
          'category', 'ADDITIONAL_ATTACHMENT',
          'filename', coalesce(e.original_filename, e.evidence_type),
          'version', e.version_no, 'mimeType', coalesce(e.mime_type, 'application/octet-stream'),
          'sizeBytes', e.file_size_bytes, 'checksum', e.sha256,
          'uploadedBy', e.created_by, 'uploadedAt', e.created_at,
          'verificationState', e.status, 'locked', false
        )
        from public.activity_evidence e
        where e.organization_id = p_organization_id
          and e.activity_id = p_activity_id and e.status = 'UPLOADED'
        union all
        select cd.decided_at, jsonb_build_object(
          'id', cd.id, 'sourceKind', 'COMMITTEE_DECISION',
          'category', 'COMMITTEE_DECISION', 'filename', 'قرار اللجنة الداخلي',
          'version', 1, 'mimeType', 'text/html', 'sizeBytes', null,
          'checksum', null, 'uploadedBy', cd.final_decision_by,
          'uploadedAt', cd.decided_at, 'verificationState', cd.decision,
          'locked', true
        )
        from public.committee_decisions cd
        where cd.organization_id = p_organization_id and cd.activity_id = p_activity_id
        union all
        select cm.created_at, jsonb_build_object(
          'id', cm.id, 'sourceKind', 'COMMITTEE_MINUTES',
          'category', 'COMMITTEE_MINUTES', 'filename', 'محضر اللجنة',
          'version', cm.version_no, 'mimeType', 'text/html', 'sizeBytes', null,
          'checksum', cm.snapshot_sha256, 'uploadedBy', cm.prepared_by,
          'uploadedAt', cm.created_at, 'verificationState', cm.status,
          'locked', (cm.status = 'FINAL')
        )
        from public.committee_minutes cm
        where cm.organization_id = p_organization_id and cm.activity_id = p_activity_id
        union all
        select ir.generated_at, jsonb_build_object(
          'id', ir.id, 'sourceKind', 'FINAL_IMPACT_REPORT',
          'category', 'FINAL_IMPACT_REPORT', 'filename', 'تقرير الأثر النهائي',
          'version', ir.version_no, 'mimeType', 'text/html', 'sizeBytes', null,
          'checksum', ir.snapshot_sha256, 'uploadedBy', ir.generated_by,
          'uploadedAt', ir.generated_at, 'verificationState', ir.status,
          'locked', (ir.status = 'FINAL')
        )
        from public.impact_reports ir
        where ir.organization_id = p_organization_id
          and ir.activity_id = p_activity_id and ir.kind = 'FINAL'
      ) doc
    ), '[]'::jsonb),
    'auditEvents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', al.event_id, 'action', al.action,
        'actorName', u.display_name,
        'roleContext', al.role_context, 'occurredAt', al.occurred_at
      ) order by al.event_sequence desc)
      from public.audit_logs al
      left join public.users u on u.id = al.user_id
      where al.organization_id = p_organization_id
        and al.entity_type = 'activity' and al.entity_id = p_activity_id
    ), '[]'::jsonb)
  ) into v_result
  from public.list_activity_dossiers_command(
    p_organization_id, p_role_context, null, null, null
  ) row
  join public.activity_evidence_readiness ready
    on ready.activity_id = row.id and ready.organization_id = p_organization_id
  where row.id = p_activity_id;

  if v_result is null then
    raise exception using errcode='42501', message='Activity is not available';
  end if;
  return v_result;
end;
$$;
revoke all on function public.get_activity_dossier_command(uuid,text,uuid)
  from public, anon;
grant execute on function public.get_activity_dossier_command(uuid,text,uuid)
  to authenticated;

create or replace function public.resolve_activity_document_download_command(
  p_organization_id uuid,
  p_role_context text,
  p_activity_id uuid,
  p_document_kind text,
  p_document_id uuid
)
returns table (
  storage_path text,
  original_filename text,
  mime_type text,
  delivery_kind text,
  internal_path text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.current_role_can_access_activity_resource(
    p_organization_id, p_role_context, p_activity_id
  ) then
    raise exception using errcode='42501', message='Document is not available';
  end if;

  if p_document_kind = 'INTAKE_DOCUMENT' then
    return query select i.storage_path, i.original_filename, i.mime_type,
      'PRIVATE_STORAGE'::text, null::text
    from public.intake_documents i
    where i.id = p_document_id and i.organization_id = p_organization_id
      and i.activity_id = p_activity_id;
  elsif p_document_kind = 'ACTIVITY_EVIDENCE' then
    return query select e.storage_path,
      coalesce(e.original_filename, e.evidence_type),
      coalesce(e.mime_type, 'application/octet-stream'),
      'PRIVATE_STORAGE'::text, null::text
    from public.activity_evidence e
    where e.id = p_document_id and e.organization_id = p_organization_id
      and e.activity_id = p_activity_id and e.status = 'UPLOADED';
  elsif p_document_kind = 'COMMITTEE_MINUTES' then
    return query select null::text, 'محضر اللجنة'::text, 'text/html'::text,
      'INTERNAL_ROUTE'::text, ('/reports/minutes/' || cm.id::text)::text
    from public.committee_minutes cm
    where cm.id = p_document_id and cm.organization_id = p_organization_id
      and cm.activity_id = p_activity_id;
  elsif p_document_kind = 'FINAL_IMPACT_REPORT' then
    return query select null::text, 'تقرير الأثر النهائي'::text, 'text/html'::text,
      'INTERNAL_ROUTE'::text,
      ('/impact/' || ir.activity_id::text || '/report/' || ir.id::text)::text
    from public.impact_reports ir
    where ir.id = p_document_id and ir.organization_id = p_organization_id
      and ir.activity_id = p_activity_id and ir.kind = 'FINAL';
  elsif p_document_kind = 'COMMITTEE_DECISION' then
    return query select null::text, 'قرار اللجنة الداخلي'::text, 'text/html'::text,
      'INTERNAL_ROUTE'::text,
      ('/committee/reviews/' || cd.review_id::text)::text
    from public.committee_decisions cd
    where cd.id = p_document_id and cd.organization_id = p_organization_id
      and cd.activity_id = p_activity_id;
  else
    raise exception using errcode='22023', message='Document kind is invalid';
  end if;

  if not found then
    raise exception using errcode='42501', message='Document is not available';
  end if;

  perform public.log_audit_event(
    p_organization_id, v_actor, p_role_context,
    'activity.document_download_authorized', 'activity', p_activity_id,
    null,
    jsonb_build_object('document_id', p_document_id, 'document_kind', p_document_kind),
    null, null, null
  );
end;
$$;
revoke all on function public.resolve_activity_document_download_command(
  uuid,text,uuid,text,uuid
) from public, anon;
grant execute on function public.resolve_activity_document_download_command(
  uuid,text,uuid,text,uuid
) to authenticated;
