import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireContext: vi.fn(),
  rpc: vi.fn(),
  signedUrl: vi.fn(),
}));

vi.mock('@/lib/auth/server-context', () => ({
  requireServerAuthContext: mocks.requireContext,
}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({ rpc: mocks.rpc })),
}));
vi.mock('@/lib/storage/private-documents', () => ({
  createPrivateDocumentSignedUrl: mocks.signedUrl,
}));

import { GET } from './route';

describe('governed dossier document download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireContext.mockResolvedValue({
      organizationId: 'org-1', activeRole: 'ACTIVITY_OFFICER', userId: 'user-1',
    });
  });

  it('redirects an authorized private file to a short-lived signed URL', async () => {
    mocks.rpc.mockResolvedValue({ data: [{
      storage_path: 'org-1/activity-1/evidence/file.pdf',
      original_filename: 'file.pdf', mime_type: 'application/pdf',
      delivery_kind: 'PRIVATE_STORAGE', internal_path: null,
    }], error: null });
    mocks.signedUrl.mockResolvedValue('https://storage.example.test/signed');
    const response = await GET(
      new Request('https://app.example.test/api/activities/activity-1/documents/document-1?kind=ACTIVITY_EVIDENCE'),
      { params: Promise.resolve({ id: 'activity-1', documentId: 'document-1' }) },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://storage.example.test/signed');
    expect(mocks.signedUrl).toHaveBeenCalledWith(expect.objectContaining({ expiresInSeconds: 180 }));
  });

  it('redirects a generated governed report only to an internal route', async () => {
    mocks.rpc.mockResolvedValue({ data: [{
      storage_path: null, original_filename: 'محضر اللجنة', mime_type: 'text/html',
      delivery_kind: 'INTERNAL_ROUTE', internal_path: '/reports/minutes/minutes-1',
    }], error: null });
    const response = await GET(
      new Request('https://app.example.test/api/activities/activity-1/documents/document-1?kind=COMMITTEE_MINUTES'),
      { params: Promise.resolve({ id: 'activity-1', documentId: 'document-1' }) },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://app.example.test/reports/minutes/minutes-1');
  });

  it('returns a non-disclosing 404 when activity or document authorization fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'private path org-1/x' } });
    const response = await GET(
      new Request('https://app.example.test/api/activities/unassigned/documents/unknown?kind=INTAKE_DOCUMENT'),
      { params: Promise.resolve({ id: 'unassigned', documentId: 'unknown' }) },
    );
    expect(response.status).toBe(404);
    expect(await response.text()).not.toMatch(/storage|path|org-1/i);
  });

  it('rejects unknown document kinds without calling the database', async () => {
    const response = await GET(
      new Request('https://app.example.test/api/activities/activity-1/documents/document-1?kind=SECRET'),
      { params: Promise.resolve({ id: 'activity-1', documentId: 'document-1' }) },
    );
    expect(response.status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
