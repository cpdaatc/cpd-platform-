\set ON_ERROR_STOP on

select public._assert(to_regclass('public.audit_logs') is not null, 'audit_logs exists');
select public._assert(to_regclass('public.audit_hash_anchors') is not null, 'audit_hash_anchors exists');

select public.log_audit_event(null, null, 'SYSTEM', 'test.first', 'test', null, null, '{"step":1}'::jsonb, null, null, 'req-1');
select public.log_audit_event(null, null, 'SYSTEM', 'test.second', 'test', null, '{"step":1}'::jsonb, '{"step":2}'::jsonb, null, null, 'req-2');

select public._assert(
  not exists (select 1 from public.verify_audit_chain(null) where ok=false),
  'fresh audit chain verifies'
);

do $$
begin
  begin
    update public.audit_logs set action='tamper'
    where organization_id is null
      and event_sequence=(select min(event_sequence) from public.audit_logs where organization_id is null);
    raise exception 'UPDATE unexpectedly succeeded';
  exception
    when others then
      if sqlerrm = 'UPDATE unexpectedly succeeded' then raise; end if;
  end;
end $$;

do $$
begin
  begin
    delete from public.audit_logs
    where organization_id is null
      and event_sequence=(select min(event_sequence) from public.audit_logs where organization_id is null);
    raise exception 'DELETE unexpectedly succeeded';
  exception
    when others then
      if sqlerrm = 'DELETE unexpectedly succeeded' then raise; end if;
  end;
end $$;

alter table public.audit_logs disable trigger audit_logs_immutable_guard;
update public.audit_logs
set action='tampered.out.of.band'
where organization_id is null
  and event_sequence=(select min(event_sequence) from public.audit_logs where organization_id is null);
alter table public.audit_logs enable trigger audit_logs_immutable_guard;

select public._assert(
  exists (select 1 from public.verify_audit_chain(null) where ok=false),
  'out-of-band tampering is detected by hash verification'
);
