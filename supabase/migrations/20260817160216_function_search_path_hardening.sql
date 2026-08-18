-- Pin the lookup path of shared trigger functions so an attacker-controlled
-- schema cannot shadow an unqualified relation or helper name.
alter function public.set_updated_at()
  set search_path = pg_catalog, public;
alter function public.audit_logs_reject_mutation()
  set search_path = pg_catalog, public;
alter function public.block_intake_document_mutation()
  set search_path = pg_catalog, public;
alter function public.protect_activity_revision_snapshot()
  set search_path = pg_catalog, public;
alter function public.protect_final_committee_minutes()
  set search_path = pg_catalog, public;
alter function public.protect_final_impact_report()
  set search_path = pg_catalog, public;
alter function public.protect_chair_approved_annual_snapshot()
  set search_path = pg_catalog, public;
alter function public.protect_finalized_impact_inputs()
  set search_path = pg_catalog, public;
alter function public.validate_external_status_transition()
  set search_path = pg_catalog, public;
