insert into public.roles(code, name_ar, name_en, scope) values
  ('PLATFORM_SUPER_ADMIN','مسؤول المنصة العام','Platform Super Admin','PLATFORM'),
  ('ORGANIZATION_SYSTEM_ADMIN','مسؤول النظام المؤسسي','Organization System Admin','ORGANIZATION'),
  ('ACTIVITY_OFFICER','مسؤول النشاط','Activity Officer','ORGANIZATION'),
  ('COMMITTEE_SECRETARY','سكرتير اللجنة','Committee Secretary','ORGANIZATION'),
  ('COMMITTEE_CHAIR','رئيس اللجنة','Committee Chair','ORGANIZATION'),
  ('COMMITTEE_MEMBER','عضو اللجنة','Committee Member','ORGANIZATION'),
  ('MANAGEMENT_VIEWER','مستخدم إداري للعرض','Management Viewer','ORGANIZATION'),
  ('MANAGEMENT_APPROVER','المخول الإداري','Management Approver','ORGANIZATION'),
  ('AUDITOR','مدقق','Auditor','ORGANIZATION')
on conflict (code) do update set
  name_ar=excluded.name_ar,
  name_en=excluded.name_en,
  scope=excluded.scope;

insert into public.permissions(code, description) values
  ('platform.manage','Manage platform-level configuration without implicit tenant business access'),
  ('organization.users.manage','Manage organization users and memberships'),
  ('organization.roles.manage','Assign organization roles'),
  ('activity.create','Create an activity'),
  ('activity.assign','Assign an activity officer'),
  ('activity.view.all','View organization activities'),
  ('activity.view.assigned','View activities assigned to the user'),
  ('activity.fill_submit','Prepare and submit activity content'),
  ('ai.run_prereview','Run AI planning/pre-review when enabled'),
  ('committee.record_collective','Record collective committee assessment'),
  ('committee.comment','Add committee review comments'),
  ('evidence.record_offline','Record that evidence was reviewed outside the platform'),
  ('evidence.verify_offline','Act as the authorized verifier of offline evidence'),
  ('minutes.draft','Prepare draft committee minutes'),
  ('activity.final_decision','Execute final internal committee activity decision'),
  ('methodology.configure','Configure draft impact methodology/follow-up policy'),
  ('methodology.approve','Activate approved impact methodology/follow-up policy'),
  ('annual.approve_committee','Approve annual report as committee chair'),
  ('annual.acknowledge','Acknowledge annual report on behalf of management'),
  ('report.view','View authorized reports and dashboards'),
  ('audit.view','Read audit events according to policy')
on conflict (code) do update set description=excluded.description;

with grants(role_code, permission_code) as (
  values
    ('PLATFORM_SUPER_ADMIN','platform.manage'),

    ('ORGANIZATION_SYSTEM_ADMIN','organization.users.manage'),
    ('ORGANIZATION_SYSTEM_ADMIN','organization.roles.manage'),
    ('ORGANIZATION_SYSTEM_ADMIN','activity.create'),
    ('ORGANIZATION_SYSTEM_ADMIN','activity.assign'),
    ('ORGANIZATION_SYSTEM_ADMIN','activity.view.all'),
    ('ORGANIZATION_SYSTEM_ADMIN','activity.fill_submit'),
    ('ORGANIZATION_SYSTEM_ADMIN','ai.run_prereview'),
    ('ORGANIZATION_SYSTEM_ADMIN','evidence.record_offline'),
    ('ORGANIZATION_SYSTEM_ADMIN','methodology.configure'),
    ('ORGANIZATION_SYSTEM_ADMIN','report.view'),
    ('ORGANIZATION_SYSTEM_ADMIN','audit.view'),

    ('ACTIVITY_OFFICER','activity.view.assigned'),
    ('ACTIVITY_OFFICER','activity.fill_submit'),
    ('ACTIVITY_OFFICER','ai.run_prereview'),

    ('COMMITTEE_SECRETARY','activity.view.all'),
    ('COMMITTEE_SECRETARY','ai.run_prereview'),
    ('COMMITTEE_SECRETARY','committee.record_collective'),
    ('COMMITTEE_SECRETARY','evidence.record_offline'),
    ('COMMITTEE_SECRETARY','minutes.draft'),
    ('COMMITTEE_SECRETARY','report.view'),

    ('COMMITTEE_CHAIR','activity.view.all'),
    ('COMMITTEE_CHAIR','ai.run_prereview'),
    ('COMMITTEE_CHAIR','committee.comment'),
    ('COMMITTEE_CHAIR','evidence.verify_offline'),
    ('COMMITTEE_CHAIR','activity.final_decision'),
    ('COMMITTEE_CHAIR','annual.approve_committee'),
    ('COMMITTEE_CHAIR','report.view'),

    ('COMMITTEE_MEMBER','activity.view.all'),
    ('COMMITTEE_MEMBER','ai.run_prereview'),
    ('COMMITTEE_MEMBER','committee.comment'),
    ('COMMITTEE_MEMBER','evidence.verify_offline'),

    ('MANAGEMENT_VIEWER','report.view'),

    ('MANAGEMENT_APPROVER','report.view'),
    ('MANAGEMENT_APPROVER','methodology.approve'),
    ('MANAGEMENT_APPROVER','annual.acknowledge'),

    ('AUDITOR','report.view'),
    ('AUDITOR','audit.view')
)
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from grants g
join public.roles r on r.code=g.role_code
join public.permissions p on p.code=g.permission_code
on conflict do nothing;
