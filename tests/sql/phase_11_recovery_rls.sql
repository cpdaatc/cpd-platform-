\set ON_ERROR_STOP on

insert into public.organizations(id,name,slug) values('90000000-0000-0000-0000-000000000099','Other Tenant','other-tenant') on conflict(id) do nothing;
insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000999','other-tenant@example.test') on conflict(id) do nothing;
insert into public.users(id,display_name) values('00000000-0000-0000-0000-000000000999','Other Tenant User') on conflict(id) do nothing;
insert into public.organization_memberships(id,organization_id,user_id,status) values('93000000-0000-0000-0000-000000000099','90000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-000000000999','ACTIVE') on conflict(id) do nothing;
insert into public.user_roles(organization_id,membership_id,role_id)
select '90000000-0000-0000-0000-000000000099','93000000-0000-0000-0000-000000000099',id from public.roles where code='ORGANIZATION_SYSTEM_ADMIN' on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',false);

select public._assert((select count(*) from public.external_submission_records where organization_id='90000000-0000-0000-0000-000000000010')=0,'other tenant cannot read external tracking rows');
select public._assert((select count(*) from public.impact_reports where organization_id='90000000-0000-0000-0000-000000000010')=0,'other tenant cannot read impact reports');
select public._assert((select count(*) from public.annual_committee_reports where organization_id='90000000-0000-0000-0000-000000000010')=0,'other tenant cannot read annual reports');
select public._assert((select count(*) from public.notifications where organization_id='90000000-0000-0000-0000-000000000010')=0,'other tenant cannot read notifications');
select public._assert((select count(*) from public.document_templates where organization_id='90000000-0000-0000-0000-000000000010')=0,'other tenant cannot read templates');
select public._assert((select count(*) from public.reference_documents where organization_id='90000000-0000-0000-0000-000000000010')=0,'other tenant cannot read tenant reference files');
select public._assert((select count(*) from public.impact_correction_requests where organization_id='90000000-0000-0000-0000-000000000010')=0,'other tenant cannot read impact correction requests');

reset role;
