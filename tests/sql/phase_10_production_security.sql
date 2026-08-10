\set ON_ERROR_STOP on

-- Every tenant business table must have PostgreSQL RLS enabled.
select public._assert(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=c.oid and a.attname='organization_id' and not a.attisdropped
    where n.nspname='public'
      and c.relkind in ('r','p')
      and not c.relrowsecurity
  ),
  'all public tenant tables carrying organization_id have RLS enabled'
);

-- Scientific final decision remains Chair-only at the role-permission layer.
select public._assert(
  (select count(*)
   from public.role_permissions rp
   join public.permissions p on p.id=rp.permission_id
   join public.roles r on r.id=rp.role_id
   where p.code='activity.final_decision')=1,
  'activity.final_decision is granted to exactly one role'
);
select public._assert(
  (select r.code
   from public.role_permissions rp
   join public.permissions p on p.id=rp.permission_id
   join public.roles r on r.id=rp.role_id
   where p.code='activity.final_decision')='COMMITTEE_CHAIR',
  'activity.final_decision remains Committee Chair only'
);

-- Methodology and privacy approvals stay with Management Approver rather than System Admin.
select public._assert(
  not exists (
    select 1 from public.role_permissions rp
    join public.permissions p on p.id=rp.permission_id
    join public.roles r on r.id=rp.role_id
    where p.code in ('methodology.approve','ai.privacy.approve')
      and r.code<>'MANAGEMENT_APPROVER'
  ),
  'methodology and external-AI privacy approval are Management Approver only'
);

-- Tenant application roles never receive an audit mutation permission.
select public._assert(
  not exists (
    select 1 from public.role_permissions rp
    join public.permissions p on p.id=rp.permission_id
    where p.code='audit.modify'
  ),
  'audit.modify is not granted to application roles'
);

-- Audit mutation guard and hash verifier remain installed after every migration.
select public._assert(
  exists (
    select 1 from pg_trigger
    where tgrelid='public.audit_logs'::regclass
      and tgname='audit_logs_immutable_guard'
      and not tgisinternal
  ),
  'audit append-only trigger remains installed'
);
select public._assert(
  to_regprocedure('public.verify_audit_chain(uuid)') is not null,
  'audit hash-chain verification function remains available'
);

-- External AI remains opt-in at the organization setting level.
select public._assert(
  not exists (
    select 1 from public.organization_ai_settings
    where external_ai_enabled=true and privacy_approved is distinct from true
  ),
  'external AI cannot be enabled without privacy approval'
);
