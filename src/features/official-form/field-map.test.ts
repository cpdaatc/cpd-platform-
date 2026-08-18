import { describe, expect, it } from 'vitest';
import { OFFICIAL_FORM_FIELDS, validateOfficialFormValues } from './field-map';

const REQUIRED_FIELDS = [
  'titleEn', 'titleAr', 'specialty', 'plannedStartDate', 'plannedEndDate',
  'collaboratorName', 'targetAudience', 'learningGap', 'aimAndOutcomes',
  'learningObjectives', 'learningMethods', 'participantEvaluationMethod',
  'speakerName', 'speakerSpecialty', 'speakerMobile', 'speakerEmail',
  'scfhsRegistrationNumber',
];

describe('official SCHS form field map', () => {
  it('maps every supported source field without adding fields to the template', () => {
    expect(Object.keys(OFFICIAL_FORM_FIELDS).sort()).toEqual(REQUIRED_FIELDS.sort());
  });

  it('keeps all overlays inside one of exactly six Letter pages', () => {
    for (const placement of Object.values(OFFICIAL_FORM_FIELDS)) {
      expect(placement.page).toBeGreaterThanOrEqual(1);
      expect(placement.page).toBeLessThanOrEqual(6);
      expect(placement.xPct).toBeGreaterThanOrEqual(0);
      expect(placement.yPct).toBeGreaterThanOrEqual(0);
      expect(placement.xPct + placement.widthPct).toBeLessThanOrEqual(100);
      expect(placement.yPct + placement.heightPct).toBeLessThanOrEqual(100);
    }
  });

  it('reports overflow rather than shrinking or changing the official layout', () => {
    const result = validateOfficialFormValues({
      ...Object.fromEntries(REQUIRED_FIELDS.map((field) => [field, ''])),
      titleEn: 'X'.repeat(500),
    });
    expect(result).toEqual([{ field: 'titleEn', maxCharacters: 120, actualCharacters: 500 }]);
  });
});
