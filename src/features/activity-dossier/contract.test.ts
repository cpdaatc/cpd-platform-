import { describe, expect, it } from 'vitest';
import {
  deriveDossierReadiness,
  filterActivityDossiers,
  type ActivityDossierListItem,
  type DossierRequirement,
} from './contract';

const ACTIVITIES: ActivityDossierListItem[] = [
  {
    id: 'activity-1',
    activityCode: 'HT-2026-001',
    titleAr: 'التواصل السريري',
    titleEn: 'Clinical Communication',
    department: { id: 'dept-training', nameAr: 'التدريب', nameEn: 'Training' },
    reportingYear: 2026,
    plannedStartDate: '2026-05-20',
    internalState: 'IMPACT_FOLLOWUP',
    committeeDecision: 'APPROVED_FOR_SCFHS_SUBMISSION',
    externalState: 'APPROVED',
    impactState: 'IN_PROGRESS',
    committeeComplete: 5,
    committeeMissing: 0,
    postActivityComplete: 1,
    postActivityMissing: 1,
    updatedAt: '2026-08-17T10:00:00Z',
  },
  {
    id: 'activity-2',
    activityCode: 'HT-2026-002',
    titleAr: 'سلامة المرضى',
    titleEn: 'Patient Safety',
    department: { id: 'dept-training', nameAr: 'التدريب', nameEn: 'Training' },
    reportingYear: 2026,
    plannedStartDate: '2026-09-08',
    internalState: 'READY_FOR_COMMITTEE',
    committeeDecision: null,
    externalState: null,
    impactState: null,
    committeeComplete: 4,
    committeeMissing: 1,
    postActivityComplete: 0,
    postActivityMissing: 2,
    updatedAt: '2026-08-18T10:00:00Z',
  },
  {
    id: 'activity-3',
    activityCode: 'HT-2025-010',
    titleAr: 'الرعاية الحرجة',
    titleEn: 'Critical Care',
    department: { id: 'dept-medical', nameAr: 'الشؤون الطبية', nameEn: 'Medical Affairs' },
    reportingYear: 2025,
    plannedStartDate: '2025-04-10',
    internalState: 'ARCHIVED',
    committeeDecision: 'APPROVED_FOR_SCFHS_SUBMISSION',
    externalState: 'APPROVED',
    impactState: 'FINAL',
    committeeComplete: 5,
    committeeMissing: 0,
    postActivityComplete: 2,
    postActivityMissing: 0,
    updatedAt: '2025-12-31T10:00:00Z',
  },
];

describe('filterActivityDossiers', () => {
  it('requires year, department and English program-name filters to match the same activity', () => {
    const result = filterActivityDossiers(ACTIVITIES, {
      reportingYear: 2026,
      departmentId: 'dept-training',
      search: 'patient safety',
    });

    expect(result.map((row) => row.activityCode)).toEqual(['HT-2026-002']);
  });

  it('finds Arabic program names and activity codes without changing the authorized result set', () => {
    expect(filterActivityDossiers(ACTIVITIES, {
      reportingYear: null,
      departmentId: null,
      search: 'الرعاية',
    }).map((row) => row.activityCode)).toEqual(['HT-2025-010']);

    expect(filterActivityDossiers(ACTIVITIES, {
      reportingYear: null,
      departmentId: null,
      search: 'ht-2026-001',
    }).map((row) => row.activityCode)).toEqual(['HT-2026-001']);
  });
});

describe('deriveDossierReadiness', () => {
  it('keeps committee readiness separate from post-activity impact readiness', () => {
    const requirements: DossierRequirement[] = [
      { code: 'OFFICIAL_FORM', labelAr: 'النموذج الرسمي', requiredFor: 'COMMITTEE', state: 'VERIFIED' },
      { code: 'AGENDA', labelAr: 'الجدول العلمي', requiredFor: 'COMMITTEE', state: 'VERIFIED' },
      { code: 'FINAL_IMPACT_REPORT', labelAr: 'تقرير الأثر النهائي', requiredFor: 'POST_ACTIVITY', state: 'MISSING' },
    ];

    expect(deriveDossierReadiness(requirements)).toEqual({
      committeeComplete: 2,
      committeeMissing: 0,
      postActivityComplete: 0,
      postActivityMissing: 1,
      unresolvedCodes: ['FINAL_IMPACT_REPORT'],
    });
  });

  it('treats rejected and superseded-without-replacement requirements as unresolved', () => {
    const requirements: DossierRequirement[] = [
      { code: 'OFFICIAL_FORM', labelAr: 'النموذج الرسمي', requiredFor: 'COMMITTEE', state: 'REJECTED' },
      { code: 'AGENDA', labelAr: 'الجدول العلمي', requiredFor: 'COMMITTEE', state: 'SUPERSEDED' },
    ];

    expect(deriveDossierReadiness(requirements)).toMatchObject({
      committeeComplete: 0,
      committeeMissing: 2,
      unresolvedCodes: ['OFFICIAL_FORM', 'AGENDA'],
    });
  });
});
