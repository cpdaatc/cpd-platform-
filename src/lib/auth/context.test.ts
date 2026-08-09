import { describe, expect, it } from 'vitest';
import {
  RoleContextError,
  resolveOrganizationContext,
  resolveRoleContext,
  requirePermissionInRoleContext,
} from './context';

describe('organization context', () => {
  it('automatically selects the only organization membership', () => {
    expect(resolveOrganizationContext(['org-a'], null)).toEqual({
      organizationId: 'org-a',
      requiresSelection: false,
    });
  });

  it('requires explicit organization selection when multiple memberships exist', () => {
    expect(resolveOrganizationContext(['org-a', 'org-b'], null)).toEqual({
      organizationId: null,
      requiresSelection: true,
    });
  });

  it('rejects an organization that is not assigned to the user', () => {
    expect(() => resolveOrganizationContext(['org-a'], 'org-b')).toThrow(RoleContextError);
  });
});

describe('role context', () => {
  it('automatically selects the only role', () => {
    expect(resolveRoleContext(['ACTIVITY_OFFICER'], null)).toEqual({
      activeRole: 'ACTIVITY_OFFICER',
      requiresSelection: false,
    });
  });

  it('requires explicit context when a user has multiple roles and no valid selection', () => {
    expect(
      resolveRoleContext(['ORGANIZATION_SYSTEM_ADMIN', 'COMMITTEE_SECRETARY'], null),
    ).toEqual({ activeRole: null, requiresSelection: true });
  });

  it('accepts a requested role only when it is actually assigned', () => {
    expect(
      resolveRoleContext(
        ['ORGANIZATION_SYSTEM_ADMIN', 'COMMITTEE_SECRETARY'],
        'COMMITTEE_SECRETARY',
      ),
    ).toEqual({ activeRole: 'COMMITTEE_SECRETARY', requiresSelection: false });

    expect(() =>
      resolveRoleContext(['COMMITTEE_SECRETARY'], 'ORGANIZATION_SYSTEM_ADMIN'),
    ).toThrow(RoleContextError);
  });

  it('does not merge permissions across roles when a role context is active', () => {
    const assignedRoles = ['ORGANIZATION_SYSTEM_ADMIN', 'COMMITTEE_SECRETARY'] as const;

    expect(() =>
      requirePermissionInRoleContext(assignedRoles, 'COMMITTEE_SECRETARY', 'activity.create'),
    ).toThrow(RoleContextError);

    expect(
      requirePermissionInRoleContext(
        assignedRoles,
        'ORGANIZATION_SYSTEM_ADMIN',
        'activity.create',
      ),
    ).toBe('ORGANIZATION_SYSTEM_ADMIN');
  });
});
