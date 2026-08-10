export const GOVERNANCE_ROLES = [
  'PLATFORM_SUPER_ADMIN','ORGANIZATION_SYSTEM_ADMIN','ACTIVITY_OFFICER','COMMITTEE_SECRETARY','COMMITTEE_CHAIR','COMMITTEE_MEMBER','MANAGEMENT_VIEWER','MANAGEMENT_APPROVER','AUDITOR',
] as const;
export type GovernanceRole=(typeof GOVERNANCE_ROLES)[number];

export const PERMISSIONS=[
  'platform.manage','organization.users.manage','organization.roles.manage',
  'activity.create','activity.assign','activity.view.all','activity.view.assigned','activity.fill_submit','activity.submit_committee',
  'ai.run_prereview','ai.manage_references','ai.resolve_source_conflict',
  'committee.manage_structure','committee.prepare','committee.record_collective','committee.comment',
  'evidence.record_offline','evidence.verify_offline','evidence.readiness.view',
  'minutes.draft','minutes.finalize','activity.final_decision',
  'external.manage','external.view','impact.manage','impact.view','impact.finalize','methodology.configure','methodology.approve',
  'annual.generate','annual.view','annual.approve_committee','annual.acknowledge',
  'notification.view','notification.manage','template.manage','template.approve','report.view','audit.view',
] as const;
export type Permission=(typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS:Record<GovernanceRole,readonly Permission[]>={
  PLATFORM_SUPER_ADMIN:['platform.manage'],
  ORGANIZATION_SYSTEM_ADMIN:[
    'organization.users.manage','organization.roles.manage','activity.create','activity.assign','activity.view.all','activity.fill_submit','activity.submit_committee',
    'ai.run_prereview','ai.manage_references','ai.resolve_source_conflict','committee.manage_structure','evidence.record_offline','evidence.readiness.view',
    'external.manage','external.view','impact.manage','impact.view','impact.finalize','methodology.configure','annual.generate','annual.view',
    'notification.view','notification.manage','template.manage','report.view','audit.view',
  ],
  ACTIVITY_OFFICER:['activity.view.assigned','activity.fill_submit','activity.submit_committee','ai.run_prereview','evidence.readiness.view','external.manage','external.view','impact.manage','impact.view','impact.finalize','notification.view'],
  COMMITTEE_SECRETARY:['activity.view.all','ai.run_prereview','committee.prepare','committee.record_collective','evidence.record_offline','evidence.readiness.view','minutes.draft','external.view','impact.view','annual.generate','annual.view','notification.view','report.view'],
  COMMITTEE_CHAIR:['activity.view.all','ai.run_prereview','ai.resolve_source_conflict','committee.comment','evidence.verify_offline','evidence.readiness.view','minutes.finalize','activity.final_decision','external.view','impact.view','annual.view','annual.approve_committee','notification.view','report.view'],
  COMMITTEE_MEMBER:['activity.view.all','ai.run_prereview','committee.comment','evidence.verify_offline','notification.view'],
  MANAGEMENT_VIEWER:['external.view','impact.view','annual.view','evidence.readiness.view','notification.view','report.view'],
  MANAGEMENT_APPROVER:['external.view','impact.view','annual.view','evidence.readiness.view','notification.view','template.approve','report.view','methodology.approve','annual.acknowledge'],
  AUDITOR:['external.view','impact.view','annual.view','evidence.readiness.view','notification.view','report.view','audit.view'],
};
export function getDefaultPermissionsForRole(role:GovernanceRole):readonly Permission[]{return ROLE_PERMISSIONS[role];}
export function roleHasPermission(role:GovernanceRole,permission:Permission):boolean{return ROLE_PERMISSIONS[role].includes(permission);}
