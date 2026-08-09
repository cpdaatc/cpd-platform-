export type IntakeRoute = 'DIGITAL' | 'PDF' | 'HYBRID';
export type ExtractionStatus = 'EXTRACTED' | 'UNCERTAIN' | 'CONFIRMED' | 'CORRECTED';

export type IntakeDraft = {
  intakeRoute: IntakeRoute;
  titleAr: string;
  titleEn: string;
  activityType: string;
  deliveryMethod: string;
  specialty: string;
  languages: string[];
  targetAudience: string;
  learningGap: string;
  aimAndOutcomes: string;
  learningMethods: string;
  participantEvaluationMethod: string;
};

type RequiredStringField = keyof Omit<IntakeDraft, 'languages' | 'intakeRoute'>;
const requiredStringFields: RequiredStringField[] = [
  'titleAr',
  'titleEn',
  'activityType',
  'deliveryMethod',
  'specialty',
  'targetAudience',
  'learningGap',
  'aimAndOutcomes',
  'learningMethods',
  'participantEvaluationMethod',
];

export function validateIntakeDraft(draft: IntakeDraft): { ok: boolean; missing: string[] } {
  const missing: string[] = requiredStringFields.filter((field) => draft[field].trim().length === 0);
  if (draft.languages.length === 0) missing.push('languages');
  return { ok: missing.length === 0, missing };
}

export function classifyExtractionConfidence(confidence: number): 'EXTRACTED' | 'UNCERTAIN' {
  return confidence >= 0.75 ? 'EXTRACTED' : 'UNCERTAIN';
}

export type ConfirmableExtractionField = {
  fieldKey: string;
  normalizedValue: string | null;
  status: ExtractionStatus;
};

export function mergeConfirmedExtraction<T extends Record<string, unknown>>(
  base: T,
  fields: ConfirmableExtractionField[],
): T & Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const field of fields) {
    if ((field.status === 'CONFIRMED' || field.status === 'CORRECTED') && field.normalizedValue !== null) {
      result[field.fieldKey] = field.normalizedValue;
    }
  }
  return result as T & Record<string, unknown>;
}
