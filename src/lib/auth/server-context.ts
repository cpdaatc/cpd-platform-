import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  resolveOrganizationContext,
  resolveRoleContext,
  requirePermissionInRoleContext,
} from './context';
import {
  GOVERNANCE_ROLES,
  type GovernanceRole,
  type Permission,
} from './permissions';

export const ORGANIZATION_CONTEXT_COOKIE = 'cpd_organization_context';
export const ROLE_CONTEXT_COOKIE = 'cpd_role_context';

type Membership = {
  id: string;
  organizationId: string;
};

type OrganizationChoice = {
  id: string;
  name: string;
  slug: string;
};

export type ServerAuthState = {
  userId: string;
  email: string | null;
  organizations: OrganizationChoice[];
  organizationId: string | null;
  membershipId: string | null;
  assignedRoles: GovernanceRole[];
  activeRole: GovernanceRole | null;
  requiresOrganizationSelection: boolean;
  requiresRoleSelection: boolean;
};

export type RequiredServerAuthContext = ServerAuthState & {
  organizationId: string;
  membershipId: string;
  activeRole: GovernanceRole;
};

export class AuthenticationRequiredError extends Error {
  constructor() {
    super('Authentication required.');
    this.name = 'AuthenticationRequiredError';
  }
}

export class ContextSelectionRequiredError extends Error {
  constructor() {
    super('Organization and role context must be selected before this action.');
    this.name = 'ContextSelectionRequiredError';
  }
}

function isGovernanceRole(value: string): value is GovernanceRole {
  return (GOVERNANCE_ROLES as readonly string[]).includes(value);
}

export async function getServerAuthState(): Promise<ServerAuthState> {
  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const authUser = authData.user;

  if (authError || !authUser) {
    throw new AuthenticationRequiredError();
  }

  const { data: membershipData, error: membershipError } = await supabase
    .from('organization_memberships')
    .select('id, organization_id')
    .eq('user_id', authUser.id)
    .eq('status', 'ACTIVE');

  if (membershipError) {
    throw new Error('Unable to load organization memberships.');
  }

  const memberships: Membership[] = (membershipData ?? []).map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
  }));
  const organizationIds = memberships.map((membership) => membership.organizationId);

  if (organizationIds.length === 0) {
    return {
      userId: authUser.id,
      email: authUser.email ?? null,
      organizations: [],
      organizationId: null,
      membershipId: null,
      assignedRoles: [],
      activeRole: null,
      requiresOrganizationSelection: true,
      requiresRoleSelection: true,
    };
  }

  const { data: organizationData, error: organizationError } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .in('id', organizationIds)
    .order('name');

  if (organizationError) {
    throw new Error('Unable to load organizations.');
  }

  const organizations: OrganizationChoice[] = (organizationData ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
  }));

  const cookieStore = await cookies();
  const requestedOrganizationCookie = cookieStore.get(ORGANIZATION_CONTEXT_COOKIE)?.value ?? null;
  const validRequestedOrganization =
    requestedOrganizationCookie && organizationIds.includes(requestedOrganizationCookie)
      ? requestedOrganizationCookie
      : null;

  const organizationContext = resolveOrganizationContext(
    organizationIds,
    validRequestedOrganization,
  );

  if (!organizationContext.organizationId) {
    return {
      userId: authUser.id,
      email: authUser.email ?? null,
      organizations,
      organizationId: null,
      membershipId: null,
      assignedRoles: [],
      activeRole: null,
      requiresOrganizationSelection: true,
      requiresRoleSelection: true,
    };
  }

  const membership = memberships.find(
    (item) => item.organizationId === organizationContext.organizationId,
  );
  if (!membership) {
    throw new ContextSelectionRequiredError();
  }

  const { data: userRoleData, error: userRoleError } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('organization_id', organizationContext.organizationId)
    .eq('membership_id', membership.id);

  if (userRoleError) {
    throw new Error('Unable to load assigned roles.');
  }

  const roleIds = (userRoleData ?? []).map((row) => String(row.role_id));
  let assignedRoles: GovernanceRole[] = [];

  if (roleIds.length > 0) {
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('id, code')
      .in('id', roleIds);

    if (roleError) {
      throw new Error('Unable to load role definitions.');
    }

    assignedRoles = (roleData ?? [])
      .map((row) => String(row.code))
      .filter(isGovernanceRole);
  }

  if (assignedRoles.length === 0) {
    return {
      userId: authUser.id,
      email: authUser.email ?? null,
      organizations,
      organizationId: organizationContext.organizationId,
      membershipId: membership.id,
      assignedRoles: [],
      activeRole: null,
      requiresOrganizationSelection: false,
      requiresRoleSelection: true,
    };
  }

  const requestedRoleCookie = cookieStore.get(ROLE_CONTEXT_COOKIE)?.value ?? null;
  const validRequestedRole =
    requestedRoleCookie && isGovernanceRole(requestedRoleCookie) && assignedRoles.includes(requestedRoleCookie)
      ? requestedRoleCookie
      : null;

  const roleContext = resolveRoleContext(assignedRoles, validRequestedRole);

  return {
    userId: authUser.id,
    email: authUser.email ?? null,
    organizations,
    organizationId: organizationContext.organizationId,
    membershipId: membership.id,
    assignedRoles,
    activeRole: roleContext.activeRole,
    requiresOrganizationSelection: false,
    requiresRoleSelection: roleContext.requiresSelection,
  };
}

export async function requireServerAuthContext(
  permission?: Permission,
): Promise<RequiredServerAuthContext> {
  const state = await getServerAuthState();

  if (!state.organizationId || !state.membershipId || !state.activeRole) {
    throw new ContextSelectionRequiredError();
  }

  if (permission) {
    requirePermissionInRoleContext(state.assignedRoles, state.activeRole, permission);
  }

  return state as RequiredServerAuthContext;
}
