import { describe, expect, it, vi } from 'vitest';
import {
  getActivityDossier,
  listActivityDossiers,
  mapActivityDossierRow,
} from './queries';

const ROW = {
  id: 'activity-1',
  activity_code: 'CPD-2026-001',
  title_ar: 'سلامة المرضى',
  title_en: 'Patient Safety',
  department_id: 'department-1',
  department_name_ar: 'الجودة',
  department_name_en: 'Quality',
  reporting_year: 2026,
  planned_start_date: '2026-10-01',
  internal_state: 'APPROVED_FOR_SCFHS_SUBMISSION',
  committee_decision: 'APPROVED_FOR_SCFHS_SUBMISSION',
  external_state: null,
  impact_state: null,
  committee_complete: 5,
  committee_missing: 0,
  post_activity_complete: 0,
  post_activity_missing: 1,
  updated_at: '2026-08-18T10:00:00Z',
};

describe('activity dossier queries', () => {
  it('maps separate lifecycle, committee, external and impact states', () => {
    expect(mapActivityDossierRow(ROW)).toMatchObject({
      activityCode: 'CPD-2026-001',
      department: { id: 'department-1', nameAr: 'الجودة', nameEn: 'Quality' },
      internalState: 'APPROVED_FOR_SCFHS_SUBMISSION',
      committeeDecision: 'APPROVED_FOR_SCFHS_SUBMISSION',
      externalState: null,
      impactState: null,
      committeeComplete: 5,
      postActivityMissing: 1,
    });
  });

  it('passes role context and all filters to the governed list RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [ROW], error: null });
    const result = await listActivityDossiers(rpc, {
      organizationId: 'org-1',
      activeRole: 'ACTIVITY_OFFICER',
    }, { reportingYear: 2026, departmentId: 'department-1', search: 'patient' });

    expect(rpc).toHaveBeenCalledWith('list_activity_dossiers_command', {
      p_organization_id: 'org-1',
      p_role_context: 'ACTIVITY_OFFICER',
      p_reporting_year: 2026,
      p_department_id: 'department-1',
      p_search: 'patient',
    });
    expect(result).toHaveLength(1);
  });

  it('rejects malformed or storage-path-bearing dossier payloads', async () => {
    const malformed = { contractVersion: 1, storage_path: 'org/private.pdf' };
    const rpc = vi.fn().mockResolvedValue({ data: malformed, error: null });
    await expect(getActivityDossier(rpc, {
      organizationId: 'org-1', activeRole: 'COMMITTEE_SECRETARY',
    }, 'activity-1')).rejects.toThrow('malformed');
  });
});
