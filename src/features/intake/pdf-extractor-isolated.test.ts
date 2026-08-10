import { describe, expect, it } from 'vitest';
import { MAX_PDF_UPLOAD_BYTES, validatePdfEnvelope } from './pdf-extractor-isolated';

describe('PDF extraction envelope', () => {
  it('accepts a bounded PDF signature', () => {
    expect(() => validatePdfEnvelope(new TextEncoder().encode('%PDF-1.7\n'))).not.toThrow();
  });

  it('rejects non-PDF bytes and oversized input before parser execution', () => {
    expect(() => validatePdfEnvelope(new TextEncoder().encode('not a pdf'))).toThrow('Missing PDF signature');
    expect(() => validatePdfEnvelope(new Uint8Array(MAX_PDF_UPLOAD_BYTES + 1))).toThrow('outside the extraction boundary');
  });
});
