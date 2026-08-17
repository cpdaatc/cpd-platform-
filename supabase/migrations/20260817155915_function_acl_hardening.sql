-- Hosted Supabase grants EXECUTE directly to its API roles when functions are
-- created. Revoking only PUBLIC therefore leaves SECURITY DEFINER functions
-- callable by anon. Close both paths while preserving explicit grants for
-- authenticated and service_role.
do $$
declare
  function_record record;
begin
  for function_record in
    select format(
      '%I.%I(%s)',
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid)
    ) as function_identity
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format(
      'revoke execute on function %s from public, anon',
      function_record.function_identity
    );
  end loop;
end
$$;

-- Make the secure posture the default for functions created by later
-- migrations. Required API roles must be granted explicitly per function.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;
