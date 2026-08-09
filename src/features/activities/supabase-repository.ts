import type { GovernanceRole } from '@/lib/auth/permissions';
import type {
  ActivityRepository,
  CreatedActivity,
  RepositoryAssignOfficerInput,
  RepositoryCreateActivityInput,
} from './service';

type RpcError = {
  code?: string;
  message: string;
};

type RpcResponse = {
  data: unknown;
  error: RpcError | null;
};

export interface ActivityRpcClient {
  rpc(functionName: string, args: Record<string, unknown>): Promise<RpcResponse>;
}

export type MembershipRoleReader = (
  organizationId: string,
  membershipId: string,
  role: GovernanceRole,
) => Promise<boolean>;

export class ActivityPersistenceError extends Error {
  constructor(message = 'Unable to persist the activity operation.') {
    super(message);
    this.name = 'ActivityPersistenceError';
  }
}

type ActivityRpcRow = {
  id: string;
  activity_code: string;
  organization_id: string;
  title_ar: string;
  title_en: string | null;
  reporting_year: number;
  internal_state: 'CREATED';
};

function isActivityRpcRow(value: unknown): value is ActivityRpcRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.activity_code === 'string' &&
    typeof row.organization_id === 'string' &&
    typeof row.title_ar === 'string' &&
    (typeof row.title_en === 'string' || row.title_en === null) &&
    typeof row.reporting_year === 'number' &&
    row.internal_state === 'CREATED'
  );
}

export function mapActivityRpcRow(value: unknown): CreatedActivity {
  if (!isActivityRpcRow(value)) {
    throw new ActivityPersistenceError('Activity command returned malformed data.');
  }

  return {
    id: value.id,
    activityCode: value.activity_code,
    organizationId: value.organization_id,
    titleAr: value.title_ar,
    titleEn: value.title_en,
    reportingYear: value.reporting_year,
    internalState: 'CREATED',
  };
}

function firstRow(data: unknown): unknown {
  if (Array.isArray(data)) return data[0];
  return data;
}

export function createSupabaseActivityRepository(
  client: ActivityRpcClient,
  membershipRoleReader: MembershipRoleReader,
): ActivityRepository {
  return {
    async createActivity(input: RepositoryCreateActivityInput) {
      const { data, error } = await client.rpc('create_activity_command', {
        p_organization_id: input.organizationId,
        p_role_context: input.roleContext,
        p_title_ar: input.titleAr,
        p_title_en: input.titleEn ?? null,
        p_activity_type: input.activityType ?? null,
        p_department_id: input.departmentId ?? null,
        p_planned_start_date: input.plannedStartDate ?? null,
        p_planned_end_date: input.plannedEndDate ?? null,
        p_delivery_method: input.deliveryMethod ?? null,
        p_reporting_year: input.reportingYear,
      });

      if (error) {
        throw new ActivityPersistenceError(error.message);
      }

      return mapActivityRpcRow(firstRow(data));
    },

    membershipHasRole(organizationId, membershipId, role) {
      return membershipRoleReader(organizationId, membershipId, role);
    },

    async assignActivityOfficer(input: RepositoryAssignOfficerInput) {
      const { data, error } = await client.rpc('assign_activity_officer_command', {
        p_organization_id: input.organizationId,
        p_role_context: input.roleContext,
        p_activity_id: input.activityId,
        p_membership_id: input.membershipId,
      });

      if (error?.code === '42501') {
        return false;
      }
      if (error) {
        throw new ActivityPersistenceError(error.message);
      }

      return typeof data === 'string' && data.length > 0;
    },
  };
}
