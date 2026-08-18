import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createPrivateDocumentSignedUrl } from '@/lib/storage/private-documents';

export const runtime = 'nodejs';

const DOCUMENT_KINDS = new Set([
  'INTAKE_DOCUMENT',
  'ACTIVITY_EVIDENCE',
  'COMMITTEE_DECISION',
  'COMMITTEE_MINUTES',
  'FINAL_IMPACT_REPORT',
]);

type ResolvedDocument = {
  storage_path: string | null;
  original_filename: string;
  mime_type: string;
  delivery_kind: 'PRIVATE_STORAGE' | 'INTERNAL_ROUTE';
  internal_path: string | null;
};

function notAvailable() {
  return new Response('المستند غير متاح.', {
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

function isResolvedDocument(value: unknown): value is ResolvedDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (row.delivery_kind === 'PRIVATE_STORAGE' || row.delivery_kind === 'INTERNAL_ROUTE')
    && (typeof row.storage_path === 'string' || row.storage_path === null)
    && (typeof row.internal_path === 'string' || row.internal_path === null)
    && typeof row.original_filename === 'string'
    && typeof row.mime_type === 'string';
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id: activityId, documentId } = await params;
  const documentKind = new URL(request.url).searchParams.get('kind') ?? '';
  if (!DOCUMENT_KINDS.has(documentKind)) return notAvailable();

  try {
    const context = await requireServerAuthContext();
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc('resolve_activity_document_download_command', {
      p_organization_id: context.organizationId,
      p_role_context: context.activeRole,
      p_activity_id: activityId,
      p_document_kind: documentKind,
      p_document_id: documentId,
    });
    if (error) return notAvailable();
    const candidate = Array.isArray(data) ? data[0] : data;
    if (!isResolvedDocument(candidate)) return notAvailable();

    let location: string;
    if (candidate.delivery_kind === 'PRIVATE_STORAGE') {
      if (!candidate.storage_path) return notAvailable();
      location = await createPrivateDocumentSignedUrl({
        organizationId: context.organizationId,
        storagePath: candidate.storage_path,
        expiresInSeconds: 180,
      });
    } else {
      if (!candidate.internal_path
        || !candidate.internal_path.startsWith('/')
        || candidate.internal_path.startsWith('//')
        || candidate.internal_path.includes('..')) return notAvailable();
      location = new URL(candidate.internal_path, request.url).toString();
    }
    return new Response(null, {
      status: 303,
      headers: { Location: location, 'Cache-Control': 'no-store' },
    });
  } catch {
    return notAvailable();
  }
}
