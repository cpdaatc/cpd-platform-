-- Production-readiness portability hardening for pgcrypto.
-- Supabase commonly installs pgcrypto in `extensions`, while standalone PostgreSQL
-- may expose it in `public`. Keep pg_catalog first and allow only the two expected
-- extension locations for existing SECURITY DEFINER functions that hash snapshots.

alter function public.submit_activity_revision_command(uuid,text,uuid,text)
  set search_path = pg_catalog, extensions, public;

alter function public.finalize_committee_minutes_command(uuid,text,uuid)
  set search_path = pg_catalog, extensions, public;

alter function public.generate_impact_report_command(uuid,text,uuid,text)
  set search_path = pg_catalog, extensions, public;

alter function public.generate_annual_committee_report_command(uuid,text,integer)
  set search_path = pg_catalog, extensions, public;

alter function public.audit_compute_hash(
  text,uuid,uuid,uuid,text,text,text,uuid,jsonb,jsonb,inet,text,text,timestamptz
)
  set search_path = pg_catalog, extensions, public;
