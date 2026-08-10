-- Production-readiness storage hardening.
-- Sensitive document bytes are accessed only by trusted server-side code after
-- application RBAC/RLS checks. Authenticated clients no longer receive direct
-- organization-wide Storage object permissions.

do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists cpd_documents_select on storage.objects';
    execute 'drop policy if exists cpd_documents_insert on storage.objects';
    execute 'drop policy if exists cpd_documents_update on storage.objects';
    execute 'drop policy if exists cpd_documents_delete on storage.objects';
  end if;
end $$;
