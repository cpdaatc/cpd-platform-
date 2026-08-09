import { describe, expect, it } from 'vitest';
import {
  classifyExtractionConfidence,
  validateIntakeDraft,
  mergeConfirmedExtraction,
  type IntakeDraft,
} from './service';

describe('Phase 2 intake service', () => {
  it('rejects incomplete required official form fields', () => {
    const draft: IntakeDraft = {
      intakeRoute: 'DIGITAL',
      titleAr: '',
      titleEn: '',
      activityType: '',
      deliveryMethod: '',
      specialty: '',
      languages: [],
      targetAudience: '',
      learningGap: '',
      aimAndOutcomes: '',
      learningMethods: '',
      participantEvaluationMethod: '',
    };
    const result = validateIntakeDraft(draft);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('titleAr');
    expect(result.missing).toContain('learningGap');
  });

  it('accepts a complete hybrid draft', () => {
    const result = validateIntakeDraft({
      intakeRoute: 'HYBRID',
      titleAr: 'نشاط تجريبي',
      titleEn: 'Demo Activity',
      activityType: 'COURSE',
      deliveryMethod: 'GROUP_INTERACTIVE',
      specialty: 'General Practice',
      languages: ['AR', 'EN'],
      targetAudience: 'Healthcare practitioners',
      learningGap: 'Documented knowledge and performance gap',
      aimAndOutcomes: 'Improve measurable practice outcomes',
      learningMethods: 'Interactive group learning',
      participantEvaluationMethod: 'Structured participant evaluation',
    });
    expect(result.ok).toBe(true);
  });

  it('marks low confidence extraction as UNCERTAIN rather than guessing', () => {
    expect(classifyExtractionConfidence(0.49)).toBe('UNCERTAIN');
    expect(classifyExtractionConfidence(0.9)).toBe('EXTRACTED');
  });

  it('only applies confirmed extraction fields', () => {
    const merged = mergeConfirmedExtraction(
      { specialty: 'Original' },
      [
        { fieldKey: 'specialty', normalizedValue: 'Cardiology', status: 'CONFIRMED' },
        { fieldKey: 'targetAudience', normalizedValue: 'Residents', status: 'UNCERTAIN' },
      ],
    );
    expect(merged.specialty).toBe('Cardiology');
    expect(merged.targetAudience).toBeUndefined();
  });
});
