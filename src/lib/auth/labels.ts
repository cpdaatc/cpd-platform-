import type { GovernanceRole } from './permissions';

export const ROLE_LABELS_AR: Record<GovernanceRole, string> = {
  PLATFORM_SUPER_ADMIN: 'مسؤول المنصة العام',
  ORGANIZATION_SYSTEM_ADMIN: 'مسؤول النظام المؤسسي',
  ACTIVITY_OFFICER: 'مسؤول النشاط',
  COMMITTEE_SECRETARY: 'سكرتير اللجنة',
  COMMITTEE_CHAIR: 'رئيس اللجنة',
  COMMITTEE_MEMBER: 'عضو اللجنة',
  MANAGEMENT_VIEWER: 'عرض الإدارة',
  MANAGEMENT_APPROVER: 'المخول الإداري',
  AUDITOR: 'مدقق',
};
