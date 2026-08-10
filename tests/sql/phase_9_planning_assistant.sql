\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
create temporary table p9_activity as select * from public.create_activity_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN','نشاط مساعد التخطيط','Planning Assistant Activity','COURSE',null,'2026-11-01','2026-11-01','GROUP_INTERACTIVE',2026);
select public.assign_activity_officer_command('90000000-0000-0000-0000-000000000010','ORGANIZATION_SYSTEM_ADMIN',(select id from p9_activity),'93000000-0000-0000-0000-000000000002');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000902',false);
select public.save_activity_intake_command('90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p9_activity),jsonb_build_object(
  'profile',jsonb_build_object('intakeRoute','DIGITAL','specialty','Education','activityLanguages',jsonb_build_array('AR'),'collaboration',false,'contentDevelopedByProvider',true,'targetAudience','Practitioners','selectAllMedicalFields',false,'learningGap','ضعف موثق في التطبيق','aimAndOutcomes','Improve','learningMethods','Workshop','participantEvaluationMethod','Checklist','activityScope','LOCAL','formStatus','DRAFT'),
  'needsAssessmentTools',jsonb_build_array(jsonb_build_object('toolCode','SURVEY')),
  'objectives',jsonb_build_array(jsonb_build_object('objectiveText','Understand the protocol','learningDomain','KNOWLEDGE','sortOrder',1)),
  'committeeMembers',jsonb_build_array(jsonb_build_object('fullName','A','sortOrder',1),jsonb_build_object('fullName','B','sortOrder',2)),
  'speakers',jsonb_build_array(), 'sessions',jsonb_build_array(), 'disclosures',jsonb_build_array()
));

create temporary table p9_gap as select public.create_planning_suggestion_command(
  '90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p9_activity),'GAP_STATEMENT','GAP',null,
  'ضعف موثق في التطبيق','الفجوة الموثقة: ضعف في التطبيق. مصدر الدليل: [حدد المصدر].','DETERMINISTIC') as id;

do $$ begin
  begin
    perform public.act_on_planning_suggestion_command('90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p9_gap),'ACCEPT',null);
    raise exception 'placeholder suggestion unexpectedly accepted';
  exception when others then
    if sqlerrm='placeholder suggestion unexpectedly accepted' then raise; end if;
    if sqlstate<>'22023' then raise; end if;
  end;
end $$;

select public.act_on_planning_suggestion_command('90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p9_gap),'EDIT_ACCEPT','الفجوة الموثقة: ضعف في التطبيق وفق نتائج استبيان الاحتياج.');
select public._assert((select learning_gap from public.activity_intake_profiles where activity_id=(select id from p9_activity))='الفجوة الموثقة: ضعف في التطبيق وفق نتائج استبيان الاحتياج.','edited accepted gap writes official working record');

create temporary table p9_obj as select id from public.activity_learning_objectives where activity_id=(select id from p9_activity) limit 1;
create temporary table p9_obj_suggestion as select public.create_planning_suggestion_command(
  '90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p9_activity),'SMART_OBJECTIVE','OBJECTIVE',(select id from p9_obj),
  'Understand the protocol','بنهاية النشاط، سيتمكن المشارك من تطبيق البروتوكول على حالة تدريبية وفق قائمة التحقق المعتمدة.','DETERMINISTIC') as id;
select public._assert((select objective_text from public.activity_learning_objectives where id=(select id from p9_obj))='Understand the protocol','proposed suggestion does not auto-write official field');
select public.act_on_planning_suggestion_command('90000000-0000-0000-0000-000000000010','ACTIVITY_OFFICER',(select id from p9_obj_suggestion),'ACCEPT',null);
select public._assert((select objective_text from public.activity_learning_objectives where id=(select id from p9_obj))='بنهاية النشاط، سيتمكن المشارك من تطبيق البروتوكول على حالة تدريبية وفق قائمة التحقق المعتمدة.','explicit acceptance writes objective');
select public._assert((select count(*) from public.ai_acceptance_events e join public.ai_suggestions s on s.id=e.suggestion_id where s.activity_id=(select id from p9_activity))=2,'planning acceptance actions are auditable');

reset role;
