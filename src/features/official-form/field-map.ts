export type OfficialFormFieldKey =
  | 'titleEn' | 'titleAr' | 'specialty' | 'plannedStartDate' | 'plannedEndDate'
  | 'collaboratorName' | 'targetAudience' | 'learningGap' | 'aimAndOutcomes'
  | 'learningObjectives' | 'learningMethods' | 'participantEvaluationMethod'
  | 'speakerName' | 'speakerSpecialty' | 'speakerMobile' | 'speakerEmail'
  | 'scfhsRegistrationNumber';

export type OfficialFormFieldPlacement = {
  page: 1 | 2 | 3 | 4 | 5 | 6;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  fontSizePt: number;
  maxCharacters: number;
  direction?: 'ltr' | 'rtl';
};

// Coordinates are measured against the six Letter pages rendered from the
// uploaded SCHS Word source. The source page artwork is never reconstructed.
export const OFFICIAL_FORM_FIELDS: Record<OfficialFormFieldKey, OfficialFormFieldPlacement> = {
  titleEn: { page: 1, xPct: 11, yPct: 22.1, widthPct: 77, heightPct: 2.6, fontSizePt: 10, maxCharacters: 120, direction: 'ltr' },
  titleAr: { page: 1, xPct: 11, yPct: 32.3, widthPct: 77, heightPct: 2.6, fontSizePt: 10, maxCharacters: 120, direction: 'rtl' },
  specialty: { page: 1, xPct: 11, yPct: 67.9, widthPct: 77, heightPct: 3.7, fontSizePt: 10, maxCharacters: 100, direction: 'ltr' },
  plannedStartDate: { page: 2, xPct: 10, yPct: 0.2, widthPct: 35, heightPct: 2.0, fontSizePt: 9, maxCharacters: 20, direction: 'ltr' },
  plannedEndDate: { page: 2, xPct: 56, yPct: 0.2, widthPct: 34, heightPct: 2.0, fontSizePt: 9, maxCharacters: 20, direction: 'ltr' },
  collaboratorName: { page: 2, xPct: 18, yPct: 25.1, widthPct: 70, heightPct: 2.3, fontSizePt: 9, maxCharacters: 110, direction: 'ltr' },
  targetAudience: { page: 3, xPct: 17, yPct: 34.1, widthPct: 70, heightPct: 2.2, fontSizePt: 9, maxCharacters: 120, direction: 'ltr' },
  learningGap: { page: 3, xPct: 14, yPct: 48.9, widthPct: 73, heightPct: 2.6, fontSizePt: 8, maxCharacters: 260, direction: 'ltr' },
  aimAndOutcomes: { page: 3, xPct: 13, yPct: 77.4, widthPct: 75, heightPct: 4.4, fontSizePt: 8, maxCharacters: 320, direction: 'ltr' },
  learningObjectives: { page: 3, xPct: 12, yPct: 89.0, widthPct: 76, heightPct: 3.2, fontSizePt: 7, maxCharacters: 300, direction: 'ltr' },
  learningMethods: { page: 4, xPct: 1.5, yPct: 13.8, widthPct: 86, heightPct: 2.1, fontSizePt: 8, maxCharacters: 220, direction: 'ltr' },
  participantEvaluationMethod: { page: 4, xPct: 1.5, yPct: 20.6, widthPct: 86, heightPct: 2.6, fontSizePt: 8, maxCharacters: 220, direction: 'ltr' },
  speakerName: { page: 5, xPct: 30, yPct: 60.4, widthPct: 56, heightPct: 1.5, fontSizePt: 8, maxCharacters: 100, direction: 'ltr' },
  speakerSpecialty: { page: 5, xPct: 30, yPct: 62.3, widthPct: 56, heightPct: 1.5, fontSizePt: 8, maxCharacters: 100, direction: 'ltr' },
  speakerMobile: { page: 5, xPct: 33, yPct: 71.0, widthPct: 53, heightPct: 1.5, fontSizePt: 8, maxCharacters: 30, direction: 'ltr' },
  speakerEmail: { page: 5, xPct: 33, yPct: 72.9, widthPct: 53, heightPct: 1.5, fontSizePt: 8, maxCharacters: 100, direction: 'ltr' },
  scfhsRegistrationNumber: { page: 6, xPct: 47, yPct: 11.9, widthPct: 39, heightPct: 1.8, fontSizePt: 8, maxCharacters: 50, direction: 'ltr' },
};

export type OfficialFormValues = Partial<Record<OfficialFormFieldKey, string | null>>;

export function validateOfficialFormValues(values: OfficialFormValues) {
  return (Object.entries(OFFICIAL_FORM_FIELDS) as Array<[OfficialFormFieldKey, OfficialFormFieldPlacement]>)
    .flatMap(([field, placement]) => {
      const value = values[field] ?? '';
      return value.length > placement.maxCharacters
        ? [{ field, maxCharacters: placement.maxCharacters, actualCharacters: value.length }]
        : [];
    });
}
