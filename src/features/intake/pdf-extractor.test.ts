import { describe, expect, it } from 'vitest';
import { assessNativeExtractionQuality, mapOfficialFormText } from './pdf-extractor';

describe('official form PDF mapping', () => {
  it('extracts only values that can be located with reasonable confidence', () => {
    const text = `
Create New Activity Accreditation Request
Activity Title in English *
Medication Safety Workshop
Activity Title in Arabic *
ورشة سلامة الدواء
Specialty*
Patient Safety
Activity Language
English Arabic
What is the intended target audience of the activity?
Healthcare practitioners
What learning needs or gap(s) in knowledge, attitudes, skills or performance of the intended target audience did the scientific planning committee identify for this activity?
Medication error reporting is inconsistent
`;
    const fields = mapOfficialFormText(text);
    const byKey = Object.fromEntries(fields.map((field) => [field.fieldKey, field]));
    expect(byKey.titleEn.normalizedValue).toBe('Medication Safety Workshop');
    expect(byKey.titleAr.normalizedValue).toBe('ورشة سلامة الدواء');
    expect(byKey.specialty.normalizedValue).toBe('Patient Safety');
    expect(byKey.targetAudience.normalizedValue).toBe('Healthcare practitioners');
    expect(assessNativeExtractionQuality([{pageNumber:1,text}],fields).requiresFallback).toBe(false);
  });

  it('does not invent a value when a label is present but no usable value follows', () => {
    const text='Activity Title in English *\nActivity Title in Arabic *\n';
    const fields = mapOfficialFormText(text);
    const title = fields.find((field) => field.fieldKey === 'titleEn');
    expect(title?.normalizedValue ?? null).toBeNull();
    expect(title?.status).toBe('UNCERTAIN');
    const quality=assessNativeExtractionQuality([{pageNumber:1,text}],fields);
    expect(quality.requiresFallback).toBe(true);
    expect(quality.suggestedEngine).toBe('OCR');
  });

  it('requires human fallback when text exists but expected structure is not recognized',()=>{
    const text='This is a long machine-readable PDF text layer. '.repeat(20);
    const fields=mapOfficialFormText(text);
    const quality=assessNativeExtractionQuality([{pageNumber:1,text}],fields);
    expect(quality.requiresFallback).toBe(true);
    expect(quality.suggestedEngine).toBe('MANUAL');
    expect(quality.recognizedFields).toBe(0);
  });
});
