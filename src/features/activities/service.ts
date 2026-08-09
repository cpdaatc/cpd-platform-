import { z } from 'zod';
import {
  type GovernanceRole,
  type Permission,
} from '@/lib/auth/permissions';
import { requirePermissionInRoleContext } from '@/lib/auth/context';

const createActivitySchema = z
  .object({
    titleAr: z.string().trim().min(3).max(250),
    titleEn: z.string().trim().min(3).max(250).optional(),
    activityType: z.string().trim().min(1).max(120).optional(),
    departmentId: z.string().uuid().optional(),
    plannedStartDate: z.string().date().optional(),
    plannedEndDate: z.string().date().optional(),
    deliveryMethod: z.string().trim().min(1).max(120).optional(),
    reportingYear: z.number().int().min(2000).max(2200),
  })
  .refine(
    (value) =>
      !value.plannedStartDate ||
      !value.plannedEndDate ||
      value.plannedEndDate >= value.plannedStartDate,
    { message: 'plannedEndDate must not be before plannedStartDate', path: ['plannedEndDate'] },
  );

export type CreateActivityInput = z.input<typeof createActivitySchema>;

export type ActivityActionContext = {
  userId: string;
  organizationId: string;
  membershipId: string;
  assignedRoles: readonly GovernanceRole[];
  activeRole: GovernanceRole;
};

export type CreatedActivity = {
  id: string;
  activityCode: string;
  organizationId: string;
  titleAr: string;
  titleEn: string | null;
  reportingYear: number;
  internalState: 'CREATED';
};

export type GovernedActivityEvent = {
  action: 'activity.created' | 'activity.officer_assigned';
  organizationId: string;
  userId: string;
  roleContext: GovernanceRole;
  entityId: string;
};

export type RepositoryCreateActivityInput = z.output<typeof createActivitySchema> & {
  organizationId: string;
  actorUserId: string;
  roleContext: GovernanceRole;
};

export type RepositoryAssignOfficerInput = {
  organizationId: string;
  activityId: string;
  membershipId: string;
  actorUserId: string;
  roleContext: GovernanceRole;
};

export interface ActivityRepository {
  /**
   * Must persist the activity and its audit event atomically.
   */
  createActivity(input: RepositoryCreateActivityInput): Promise<CreatedActivity>;
  membershipHasRole(
    organizationId: string,
    membershipId: string,
    role: GovernanceRole,
  ): Promise<boolean>;
  /**
   * Must persist the assignment and its audit event atomically.
   * Returns false if the activity is not owned by organizationId.
   */
  assignActivityOfficer(input: RepositoryAssignOfficerInput): Promise<boolean>;
}

export class ActivityAuthorizationError extends Error {
  constructor(message = 'This role context is not authorized for the requested activity action.') {
    super(message);
    this.name = 'ActivityAuthorizationError';
  }
}

export class ActivityValidationError extends Error {
  constructor(message = 'Activity data is invalid.') {
    super(message);
    this.name = 'ActivityValidationError';
  }
}

function authorize(context: ActivityActionContext, permission: Permission) {
  try {
    requirePermissionInRoleContext(context.assignedRoles, context.activeRole, permission);
  } catch {
    throw new ActivityAuthorizationError();
  }
}

export async function createActivity(
  input: CreateActivityInput,
  context: ActivityActionContext,
  repository: ActivityRepository,
): Promise<CreatedActivity> {
  authorize(context, 'activity.create');

  const parsed = createActivitySchema.safeParse(input);
  if (!parsed.success) {
    throw new ActivityValidationError(parsed.error.issues.map((issue) => issue.message).join('; '));
  }

  return repository.createActivity({
    ...parsed.data,
    organizationId: context.organizationId,
    actorUserId: context.userId,
    roleContext: context.activeRole,
  });
}

export async function assignActivityOfficer(
  activityId: string,
  membershipId: string,
  context: ActivityActionContext,
  repository: ActivityRepository,
): Promise<void> {
  authorize(context, 'activity.assign');

  if (!activityId.trim() || !membershipId.trim()) {
    throw new ActivityValidationError('Activity and officer membership are required.');
  }

  const isOfficer = await repository.membershipHasRole(
    context.organizationId,
    membershipId,
    'ACTIVITY_OFFICER',
  );

  if (!isOfficer) {
    throw new ActivityAuthorizationError(
      'The selected membership is not an Activity Officer in this organization.',
    );
  }

  const assigned = await repository.assignActivityOfficer({
    organizationId: context.organizationId,
    activityId,
    membershipId,
    actorUserId: context.userId,
    roleContext: context.activeRole,
  });

  if (!assigned) {
    throw new ActivityAuthorizationError('The activity does not belong to this organization.');
  }
}
