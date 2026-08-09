export const GOVERNANCE_ROLES = [
  'PLATFORM_SUPER_ADMIN',
  'ORGANIZATION_SYSTEM_ADMIN',
  'ACTIVITY_OFFICER',
  'COMMITTEE_SECRETARY',
  'COMMITTEE_CHAIR',
  'COMMITTEE_MEMBER',
  'MANAGEMENT_VIEWER',
  'MANAGEMENT_APPROVER',
  'AUDITOR',
] as const;

export type GovernanceRole = (typeof GOVERNANCE_ROLES)[number];

export const PERMISSIONS = [
  'platform.manage',
  'organization.users.manage',
  'organization.roles.manage',
  'activity.create',
  'activity.assign',
  'activity.view.all',
  'activity.view.assigned',
  'activity.fill_submit',
  'ai.run_prereview',
  'committee.record_collective',
  'committee.comment',
  'evidence.record_offline',
  'evidence.verify_offline',
  'minutes.draft',
  'activity.final_decision',
  'methodology.configure',
  'methodology.approve',
  'annual.approve_committee',
  'annual.acknowledge',
  'report.view',
  'audit.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<GovernanceRole, readonly Permission[]> = {
  PLATFORM_SUPER_ADMIN: ['platform.manage'],
  ORGANIZATION_SYSTEM_ADMIN: [
    'organization.users.manage',
    'organization.roles.manage',
    'activity.create',
    'activity.assign',
    'activity.view.all',
    'activity.fill_submit',
    'ai.run_prereview',
    'evidence.record_offline',
    'methodology.configure',
    'report.view',
    'audit.view',
  ],
  ACTIVITY_OFFICER: [
    'activity.view.assigned',
    'activity.fill_submit',
    'ai.run_prereview',
  ],
  COMMITTEE_SECRETARY: [
    'activity.view.all',
    'ai.run_prereview',
    'committee.record_collective',
    'evidence.record_offline',
    'minutes.draft',
    'report.view',
  ],
  COMMITTEE_CHAIR: [
    'activity.view.all',
    'ai.run_prereview',
    'committee.comment',
    'evidence.verify_offline',
    'activity.final_decision',
    'annual.approve_committee',
    'report.view',
  ],
  COMMITTEE_MEMBER: [
    'activity.view.all',
    'ai.run_prereview',
    'committee.comment',
    'evidence.verify_offline',
  ],
  MANAGEMENT_VIEWER: ['report.view'],
  MANAGEMENT_APPROVER: ['report.view', 'methodology.approve', 'annual.acknowledge'],
  AUDITOR: ['report.view', 'audit.view'],
};

export function getDefaultPermissionsForRole(role: GovernanceRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function roleHasPermission(role: GovernanceRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
