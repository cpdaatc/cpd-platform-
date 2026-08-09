import { describe, expect, it } from 'vitest';
import { prepareExternalAiRequest } from './provider';

describe('external AI privacy gate', () => {
  it('blocks production-like use until privacy approval and region/provider are configured', () => {
    expect(() => prepareExternalAiRequest(
      { purpose: 'PRE_REVIEW', payload: { objective: 'Apply protocol' } },
      { externalAiEnabled: false, privacyApproved: false, provider: null, processingRegion: null },
    )).toThrow(/disabled/i);
  });

  it('redacts PII from approved external requests', () => {
    const request = prepareExternalAiRequest(
      { purpose: 'PRE_REVIEW', payload: { email: 'x@example.test', objective: 'Apply protocol' } },
      { externalAiEnabled: true, privacyApproved: true, provider: 'approved-provider', processingRegion: 'approved-region' },
    );
    expect(request.payload.email).toBe('[REDACTED]');
    expect(request.payload.objective).toBe('Apply protocol');
  });
});
