import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'cpd-documents';

function assertOrganizationPath(organizationId: string, storagePath: string) {
  const prefix = `${organizationId}/`;
  if (!storagePath.startsWith(prefix) || storagePath.includes('..')) {
    throw new Error('Storage path is outside the active organization boundary.');
  }
}

export async function uploadPrivateDocument(options: {
  organizationId: string;
  storagePath: string;
  bytes: Uint8Array;
  contentType: string;
}) {
  assertOrganizationPath(options.organizationId, options.storagePath);
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(options.storagePath, options.bytes, {
    contentType: options.contentType,
    upsert: false,
  });
  if (error) throw new Error(`Private document upload failed: ${error.message}`);
}

export async function removePrivateDocument(organizationId: string, storagePath: string) {
  assertOrganizationPath(organizationId, storagePath);
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from(BUCKET).remove([storagePath]);
  if (error) throw new Error(`Private document cleanup failed: ${error.message}`);
}

export async function createPrivateDocumentSignedUrl(options: {
  organizationId: string;
  storagePath: string;
  expiresInSeconds?: number;
}) {
  assertOrganizationPath(options.organizationId, options.storagePath);
  const admin = createSupabaseAdminClient();
  const expiresIn = Math.min(Math.max(options.expiresInSeconds ?? 300, 60), 900);
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(options.storagePath, expiresIn);
  if (error || !data?.signedUrl) throw new Error('Unable to create private document access URL.');
  return data.signedUrl;
}
