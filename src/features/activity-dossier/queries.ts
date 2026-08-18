import type { GovernanceRole } from '@/lib/auth/permissions';
import type {
  ActivityDossier,
  ActivityDossierListItem,
  DossierFilters,
} from './contract';

type RpcResponse = { data: unknown; error: { message: string; code?: string } | null };
export type ActivityDossierRpc = (
  functionName: string,
  args: Record<string, unknown>,
) => Promise<RpcResponse>;

export type DossierQueryContext = {
  organizationId: string;
  activeRole: GovernanceRole;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Activity dossier response is malformed.');
  }
  return value as Record<string, unknown>;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Activity dossier response is malformed.');
  return value;
}

function requiredNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error('Activity dossier response is malformed.');
  return number;
}

export function mapActivityDossierRow(value: unknown): ActivityDossierListItem {
  const row = record(value);
  return {
    id: requiredString(row.id),
    activityCode: requiredString(row.activity_code),
    titleAr: requiredString(row.title_ar),
    titleEn: nullableString(row.title_en),
    department: {
      id: nullableString(row.department_id),
      nameAr: nullableString(row.department_name_ar),
      nameEn: nullableString(row.department_name_en),
    },
    reportingYear: requiredNumber(row.reporting_year),
    plannedStartDate: nullableString(row.planned_start_date),
    internalState: requiredString(row.internal_state),
    committeeDecision: nullableString(row.committee_decision),
    externalState: nullableString(row.external_state),
    impactState: nullableString(row.impact_state),
    committeeComplete: requiredNumber(row.committee_complete),
    committeeMissing: requiredNumber(row.committee_missing),
    postActivityComplete: requiredNumber(row.post_activity_complete),
    postActivityMissing: requiredNumber(row.post_activity_missing),
    updatedAt: requiredString(row.updated_at),
  };
}

export async function listActivityDossiers(
  rpc: ActivityDossierRpc,
  context: DossierQueryContext,
  filters: DossierFilters,
): Promise<ActivityDossierListItem[]> {
  const { data, error } = await rpc('list_activity_dossiers_command', {
    p_organization_id: context.organizationId,
    p_role_context: context.activeRole,
    p_reporting_year: filters.reportingYear,
    p_department_id: filters.departmentId,
    p_search: filters.search,
  });
  if (error) throw new Error('تعذر تحميل ملفات الأنشطة المصرح بها.');
  if (!Array.isArray(data)) throw new Error('Activity dossier response is malformed.');
  return data.map(mapActivityDossierRow);
}

function isDossier(value: unknown): value is ActivityDossier {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (JSON.stringify(value).includes('storage_path')) return false;
  const row = value as Partial<ActivityDossier>;
  return row.contractVersion === 1
    && Boolean(row.activity && typeof row.activity.id === 'string')
    && Array.isArray(row.requirements)
    && Array.isArray(row.documents)
    && Array.isArray(row.auditEvents);
}

export async function getActivityDossier(
  rpc: ActivityDossierRpc,
  context: DossierQueryContext,
  activityId: string,
): Promise<ActivityDossier> {
  const { data, error } = await rpc('get_activity_dossier_command', {
    p_organization_id: context.organizationId,
    p_role_context: context.activeRole,
    p_activity_id: activityId,
  });
  if (error) throw new Error('تعذر تحميل ملف النشاط أو أن النشاط غير متاح.');
  const payload = Array.isArray(data) && data.length === 1 ? data[0] : data;
  if (!isDossier(payload)) throw new Error('Activity dossier response is malformed.');
  return payload;
}
