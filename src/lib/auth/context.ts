import {
  type GovernanceRole,
  type Permission,
  roleHasPermission,
} from './permissions';

export class RoleContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoleContextError';
  }
}

export type ResolvedRoleContext = {
  activeRole: GovernanceRole | null;
  requiresSelection: boolean;
};

export function resolveRoleContext(
  assignedRoles: readonly GovernanceRole[],
  requestedRole: GovernanceRole | null,
): ResolvedRoleContext {
  if (assignedRoles.length === 0) {
    throw new RoleContextError('No active role is assigned for this organization.');
  }

  if (requestedRole !== null) {
    if (!assignedRoles.includes(requestedRole)) {
      throw new RoleContextError('Requested role context is not assigned to this user.');
    }

    return { activeRole: requestedRole, requiresSelection: false };
  }

  if (assignedRoles.length === 1) {
    return { activeRole: assignedRoles[0], requiresSelection: false };
  }

  return { activeRole: null, requiresSelection: true };
}

export function requirePermissionInRoleContext(
  assignedRoles: readonly GovernanceRole[],
  activeRole: GovernanceRole,
  permission: Permission,
): GovernanceRole {
  if (!assignedRoles.includes(activeRole)) {
    throw new RoleContextError('Active role context is not assigned to this user.');
  }

  if (!roleHasPermission(activeRole, permission)) {
    throw new RoleContextError(`Active role context does not grant ${permission}.`);
  }

  return activeRole;
}
