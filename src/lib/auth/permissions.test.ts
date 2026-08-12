import { describe, expect, it } from 'vitest';
import { GOVERNANCE_ROLES, roleHasPermission } from './permissions';

describe('foundation RBAC defaults', () => {
  it('defines the nine canonical roles', () => {
    expect(GOVERNANCE_ROLES).toHaveLength(9);
    expect(GOVERNANCE_ROLES).toContain('ORGANIZATION_SYSTEM_ADMIN');
    expect(GOVERNANCE_ROLES).toContain('COMMITTEE_SECRETARY');
    expect(GOVERNANCE_ROLES).toContain('COMMITTEE_CHAIR');
    expect(GOVERNANCE_ROLES).toContain('MANAGEMENT_APPROVER');
  });

  it('reserves final activity decision for the committee chair', () => {
    for (const role of GOVERNANCE_ROLES) {
      expect(roleHasPermission(role, 'activity.final_decision')).toBe(role === 'COMMITTEE_CHAIR');
    }
  });

  it('reserves methodology approval and annual acknowledgement for management approver', () => {
    expect(roleHasPermission('MANAGEMENT_APPROVER', 'methodology.approve')).toBe(true);
    expect(roleHasPermission('MANAGEMENT_APPROVER', 'annual.acknowledge')).toBe(true);
    expect(roleHasPermission('ORGANIZATION_SYSTEM_ADMIN', 'methodology.approve')).toBe(false);
  });

  it('keeps external AI configuration separate from privacy approval', () => {
    expect(roleHasPermission('ORGANIZATION_SYSTEM_ADMIN', 'ai.settings.configure')).toBe(true);
    expect(roleHasPermission('ORGANIZATION_SYSTEM_ADMIN', 'ai.settings.approve')).toBe(false);
    expect(roleHasPermission('MANAGEMENT_APPROVER', 'ai.settings.configure')).toBe(false);
    expect(roleHasPermission('MANAGEMENT_APPROVER', 'ai.settings.approve')).toBe(true);
  });

  it('keeps impact correction requests separate from approval', () => {
    expect(roleHasPermission('ACTIVITY_OFFICER', 'impact.correction.request')).toBe(true);
    expect(roleHasPermission('ORGANIZATION_SYSTEM_ADMIN', 'impact.correction.request')).toBe(true);
    expect(roleHasPermission('MANAGEMENT_APPROVER', 'impact.correction.approve')).toBe(true);
    expect(roleHasPermission('ACTIVITY_OFFICER', 'impact.correction.approve')).toBe(false);
  });

  it('does not allow an activity officer to create activities', () => {
    expect(roleHasPermission('ACTIVITY_OFFICER', 'activity.create')).toBe(false);
    expect(roleHasPermission('ORGANIZATION_SYSTEM_ADMIN', 'activity.create')).toBe(true);
  });
});
