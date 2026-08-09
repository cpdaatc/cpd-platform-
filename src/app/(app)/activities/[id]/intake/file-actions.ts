'use server';

import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]);

function safeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  return cleaned.slice(-120) || 'document.bin';
}

async function uploadPrivateFile(activityId: string, prefix: string, file: File) {
  const context = await requireServerAuthContext('activity.fill_submit');
  if (!allowedMimeTypes.has(file.type) || file.size <= 0 || file.size > 20 * 1024 * 1024) {
    return { context, error: 'INVALID_FILE' as const };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const storagePath = `${context.organizationId}/${activityId}/${prefix}/${Date.now()}-${safeFilename(file.name)}`;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.storage.from('cpd-documents').upload(storagePath, bytes, { contentType: file.type, upsert: false });
  return { context, supabase, storagePath, sha256, error: error ? 'UPLOAD_FAILED' as const : null };
}

export async function saveSpeakerContactAction(formData: FormData): Promise<void> {
  const context = await requireServerAuthContext('activity.fill_submit');
  const activityId = String(formData.get('activityId') ?? '');
  const activitySpeakerId = String(formData.get('activitySpeakerId') ?? '');
  if (!activityId || !activitySpeakerId) redirect(`/activities/${activityId}/intake?contactError=1`);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc('save_activity_speaker_contact_command', {
    p_organization_id: context.organizationId,
    p_role_context: context.activeRole,
    p_activity_speaker_id: activitySpeakerId,
    p_mobile: String(formData.get('mobile') ?? ''),
    p_email: String(formData.get('email') ?? ''),
    p_scfhs_registration_number: String(formData.get('scfhsRegistrationNumber') ?? ''),
  });
  if (error) redirect(`/activities/${activityId}/intake?contactError=1`);
  redirect(`/activities/${activityId}/intake?speakerContactSaved=1`);
}

export async function uploadSpeakerCvAction(formData: FormData): Promise<void> {
  const activityId = String(formData.get('activityId') ?? '');
  const activitySpeakerId = String(formData.get('activitySpeakerId') ?? '');
  const file = formData.get('file');
  if (!activityId || !activitySpeakerId || !(file instanceof File)) redirect(`/activities/${activityId}/intake?fileError=1`);

  const upload = await uploadPrivateFile(activityId, 'speaker-cv', file as File);
  if (upload.error || !upload.supabase || !upload.storagePath || !upload.sha256) redirect(`/activities/${activityId}/intake?fileError=1`);

  const { error } = await upload.supabase.rpc('register_activity_speaker_document_command', {
    p_organization_id: upload.context.organizationId,
    p_role_context: upload.context.activeRole,
    p_activity_speaker_id: activitySpeakerId,
    p_document_type: 'CV',
    p_storage_path: upload.storagePath,
    p_sha256: upload.sha256,
  });
  if (error) {
    await upload.supabase.storage.from('cpd-documents').remove([upload.storagePath]);
    redirect(`/activities/${activityId}/intake?fileError=1`);
  }
  redirect(`/activities/${activityId}/intake?cvUploaded=1`);
}

export async function uploadEvidenceAction(formData: FormData): Promise<void> {
  const activityId = String(formData.get('activityId') ?? '');
  const evidenceType = String(formData.get('evidenceType') ?? 'OTHER').trim() || 'OTHER';
  const notes = String(formData.get('notes') ?? '').trim();
  const file = formData.get('file');
  if (!activityId || !(file instanceof File)) redirect(`/activities/${activityId}/intake?fileError=1`);

  const upload = await uploadPrivateFile(activityId, 'evidence', file as File);
  if (upload.error || !upload.supabase || !upload.storagePath || !upload.sha256) redirect(`/activities/${activityId}/intake?fileError=1`);
  const { error } = await upload.supabase.rpc('register_activity_evidence_command', {
    p_organization_id: upload.context.organizationId,
    p_role_context: upload.context.activeRole,
    p_activity_id: activityId,
    p_evidence_type: evidenceType,
    p_storage_path: upload.storagePath,
    p_sha256: upload.sha256,
    p_notes: notes || null,
  });
  if (error) {
    await upload.supabase.storage.from('cpd-documents').remove([upload.storagePath]);
    redirect(`/activities/${activityId}/intake?fileError=1`);
  }
  redirect(`/activities/${activityId}/intake?evidenceUploaded=1`);
}
