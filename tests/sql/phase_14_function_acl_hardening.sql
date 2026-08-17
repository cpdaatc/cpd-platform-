\set ON_ERROR_STOP on

select public._assert(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anonymous callers cannot execute public SECURITY DEFINER functions'
);

select public._assert(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and exists (
        select 1
        from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
        where acl.grantee = 0
          and acl.privilege_type = 'EXECUTE'
      )
  ),
  'PUBLIC cannot execute public SECURITY DEFINER functions'
);

select public._assert(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'set_updated_at',
        'audit_logs_reject_mutation',
        'block_intake_document_mutation',
        'protect_activity_revision_snapshot',
        'protect_final_committee_minutes',
        'protect_final_impact_report',
        'protect_chair_approved_annual_snapshot',
        'protect_finalized_impact_inputs',
        'validate_external_status_transition'
      ])
      and not exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) setting
        where setting like 'search_path=%'
      )
  ),
  'public trigger functions have an immutable search_path'
);
