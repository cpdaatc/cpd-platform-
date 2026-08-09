insert into public.regulatory_rules(rule_code,title,rule_scope,requirement_type,status)
values('ACT-ALIGN-001','Objective–Method–Evaluation Alignment','EDUCATIONAL_GUIDANCE','GUIDANCE','ACTIVE')
on conflict do nothing;

insert into public.rule_versions(
  rule_id,source_document_id,version_label,requirement_summary,evidence_expected,ai_check_supported,human_confirmation_required,status
)
select r.id,d.id,'1.0',
  'Learning objectives should be reviewed for alignment with the selected educational method and evaluation approach.',
  'Objective text, learning method, and evaluation method',true,true,'ACTIVE'
from public.regulatory_rules r
join public.reference_documents d on d.source_code='CPD_EDUCATIONAL_GUIDANCE' and d.organization_id is null
where r.rule_code='ACT-ALIGN-001' and r.organization_id is null
on conflict(rule_id,version_label) do nothing;
