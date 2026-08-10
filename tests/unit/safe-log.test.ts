import { describe, expect, it, vi } from 'vitest';
import { buildSafeDiagnosticEvent, safeDiagnosticLog } from '@/lib/observability/safe-log';

describe('privacy-safe diagnostics', () => {
  it('serializes only allowlisted operational metadata', () => {
    expect(buildSafeDiagnosticEvent({
      operation: 'committee.minutes_finalize',
      outcome: 'success',
      requestId: 'req-123',
      organizationId: 'org-123',
      entityType: 'committee_minutes',
      entityId: 'minutes-123',
      status: 'FINAL',
      errorCode: null,
    })).toMatchObject({
      operation: 'committee.minutes_finalize',
      outcome: 'success',
      requestId: 'req-123',
      organizationId: 'org-123',
      entityType: 'committee_minutes',
      entityId: 'minutes-123',
      status: 'FINAL',
    });
  });

  it.each(['password','token','authorization','email','raw','evidence','payload','documentText','serviceRoleKey'])('rejects forbidden diagnostic key %s', (key) => {
    expect(() => buildSafeDiagnosticEvent({ operation: 'test', outcome: 'failure', [key]: 'sensitive' } as never)).toThrow('Forbidden diagnostic field');
  });

  it('never logs arbitrary Error messages that may contain PII', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    safeDiagnosticLog({
      operation: 'activity.pdf_extract',
      outcome: 'failure',
      errorCode: 'PDF_EXTRACTION_FAILED',
    }, new Error('user@example.test token=super-secret raw patient text'));
    const serialized = JSON.stringify(spy.mock.calls);
    expect(serialized).not.toContain('user@example.test');
    expect(serialized).not.toContain('super-secret');
    expect(serialized).not.toContain('patient text');
    expect(serialized).toContain('PDF_EXTRACTION_FAILED');
    spy.mockRestore();
  });
});
