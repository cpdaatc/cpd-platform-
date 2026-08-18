export type DossierPhase = 'COMMITTEE' | 'POST_ACTIVITY';
export type RequirementState = 'VERIFIED' | 'MISSING' | 'REJECTED' | 'SUPERSEDED';

export const ACTIVITY_DOSSIER_CONTRACT_VERSION = 1 as const;

export type DossierDocumentCategory =
  | 'OFFICIAL_FORM'
  | 'COMMITTEE_DECISION'
  | 'COMMITTEE_MINUTES'
  | 'FINAL_IMPACT_REPORT'
  | 'ADDITIONAL_ATTACHMENT';

export type DepartmentSummary = {
  id: string | null;
  nameAr: string | null;
  nameEn: string | null;
};

export type ActivityDossierListItem = {
  id: string;
  activityCode: string;
  titleAr: string;
  titleEn: string | null;
  department: DepartmentSummary;
  reportingYear: number;
  plannedStartDate: string | null;
  internalState: string;
  committeeDecision: string | null;
  externalState: string | null;
  impactState: string | null;
  committeeComplete: number;
  committeeMissing: number;
  postActivityComplete: number;
  postActivityMissing: number;
  updatedAt: string;
};

export type DossierFilters = {
  reportingYear: number | null;
  departmentId: string | null;
  search: string;
};

export type DossierRequirement = {
  code: string;
  labelAr: string;
  requiredFor: DossierPhase;
  state: RequirementState;
};

export type DossierReadiness = {
  committeeComplete: number;
  committeeMissing: number;
  postActivityComplete: number;
  postActivityMissing: number;
  unresolvedCodes: string[];
};

export type DossierDocument = {
  id: string;
  sourceKind:
    | 'INTAKE_DOCUMENT'
    | 'ACTIVITY_EVIDENCE'
    | 'COMMITTEE_DECISION'
    | 'COMMITTEE_MINUTES'
    | 'FINAL_IMPACT_REPORT';
  category: DossierDocumentCategory;
  filename: string;
  version: number;
  mimeType: string;
  sizeBytes: number | null;
  checksum: string | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
  verificationState: string | null;
  locked: boolean;
};

export type ActivityDossier = {
  contractVersion: typeof ACTIVITY_DOSSIER_CONTRACT_VERSION;
  activity: ActivityDossierListItem;
  assignedOfficer: { membershipId: string; displayName: string } | null;
  requirements: DossierRequirement[];
  documents: DossierDocument[];
  auditEvents: Array<{
    id: string;
    action: string;
    actorName: string | null;
    roleContext: string;
    occurredAt: string;
  }>;
};

export function filterActivityDossiers(
  items: readonly ActivityDossierListItem[],
  filters: DossierFilters,
): ActivityDossierListItem[] {
  const query = filters.search.trim().toLocaleLowerCase(['ar', 'en']);

  return items.filter((item) => {
    const matchesYear = filters.reportingYear === null
      || item.reportingYear === filters.reportingYear;
    const matchesDepartment = filters.departmentId === null
      || item.department.id === filters.departmentId;
    const matchesSearch = query.length === 0
      || [item.activityCode, item.titleAr, item.titleEn ?? ''].some((value) =>
        value.toLocaleLowerCase(['ar', 'en']).includes(query),
      );

    return matchesYear && matchesDepartment && matchesSearch;
  });
}

export function deriveDossierReadiness(
  requirements: readonly DossierRequirement[],
): DossierReadiness {
  const readiness: DossierReadiness = {
    committeeComplete: 0,
    committeeMissing: 0,
    postActivityComplete: 0,
    postActivityMissing: 0,
    unresolvedCodes: [],
  };

  for (const requirement of requirements) {
    const complete = requirement.state === 'VERIFIED';
    if (requirement.requiredFor === 'COMMITTEE') {
      if (complete) readiness.committeeComplete += 1;
      else readiness.committeeMissing += 1;
    } else if (complete) {
      readiness.postActivityComplete += 1;
    } else {
      readiness.postActivityMissing += 1;
    }

    if (!complete) readiness.unresolvedCodes.push(requirement.code);
  }

  return readiness;
}
