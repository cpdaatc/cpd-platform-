\set ON_ERROR_STOP on

insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000907','new-user@example.test') on conflict(id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);

create temporary table p9_membership as select public.ensure_organization_membership_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN','00000000-0000-0000-0000-000000000907') as id;
select public.set_organization_user_roles_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',(select id from p9_membership),array['ACTIVITY_OFFICER','COMMITTEE_SECRETARY']);
select public._assert((select role_codes @> array['ACTIVITY_OFFICER','COMMITTEE_SECRETARY'] from public.list_organization_users_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN') where user_id='00000000-0000-0000-0000-000000000907'),'organization roles are governed and listed');

create temporary table p9_ref_a as select public.register_reference_document_command(
  '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN','P9-SOURCE-A','Test Source A','ACCREDITATION_STANDARD',1,'1.0','2026-01-01',null,'https://example.invalid/a',
  '90000000-0000-0000-0000-000000000010/references/source-a.pdf',repeat('a',64),'application/pdf',1000,10) as id;
create temporary table p9_ref_b as select public.register_reference_document_command(
  '90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN','P9-SOURCE-B','Test Source B','OPERATIONAL_GUIDANCE',2,'1.0','2026-01-01',null,'https://example.invalid/b',
  '90000000-0000-0000-0000-000000000010/references/source-b.pdf',repeat('b',64),'application/pdf',1200,12) as id;
select public._assert((select source_sha256 from public.reference_documents where id=(select id from p9_ref_a))=repeat('a',64),'reference document preserves file hash');

reset role;
insert into public.source_conflicts(id,organization_id,rule_code,source_document_a_id,source_document_b_id,conflict_summary,status,detected_by)
values('99000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000010','P9-RULE',(select id from p9_ref_a),(select id from p9_ref_b),'Two source versions conflict for testing','OPEN','00000000-0000-0000-0000-000000000901');

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000904',false);
select public.resolve_source_conflict_command('90000000-0000-0000-0000-000000000010','COMMITTEE_CHAIR','99000000-0000-0000-0000-000000000001',(select id from p9_ref_a),'Use source A for this rule because the governance review identified it as the applicable authority/version.');
select public._assert((select status from public.source_conflicts where id='99000000-0000-0000-0000-000000000001')='RESOLVED','source conflict requires explicit human resolution');
select public._assert((select count(*) from public.source_conflict_resolutions where conflict_id='99000000-0000-0000-0000-000000000001')=1,'source conflict resolution is separately recorded');

reset role;
