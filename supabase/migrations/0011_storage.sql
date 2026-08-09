-- Supabase Storage is not present in the lightweight PostgreSQL CI stub.
-- In a real Supabase project this migration creates a private bucket and tenant-aware policies.
do $$
begin
  if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
    execute $sql$
      insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values('cpd-documents','cpd-documents',false,20971520,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png'])
      on conflict(id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types
    $sql$;

    execute 'drop policy if exists cpd_documents_select on storage.objects';
    execute 'drop policy if exists cpd_documents_insert on storage.objects';

    execute $sql$
      create policy cpd_documents_select on storage.objects
      for select to authenticated
      using (
        bucket_id='cpd-documents'
        and public.is_org_member(((storage.foldername(name))[1])::uuid)
      )
    $sql$;

    execute $sql$
      create policy cpd_documents_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id='cpd-documents'
        and public.is_org_member(((storage.foldername(name))[1])::uuid)
      )
    $sql$;
  end if;
end $$;
