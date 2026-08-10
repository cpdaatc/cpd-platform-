'use server';

import { revalidatePath } from 'next/cache';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function recordExternalStatusAction(formData: FormData): Promise<void> {
  const context = await requireServerAuthContext('external.manage');
  const supabase = await createServerSupabaseClient();
  const activityId = String(formData.get('activityId') ?? '');
  const status = String(formData.get('status') ?? '');
  const approvedHoursRaw = String(formData.get('approvedHours') ?? '').trim();
  const { error } = await supabase.rpc('record_external_status_command', {
    p_organization_id: context.organizationId,
    p_role_context: context.activeRole,
    p_activity_id: activityId,
    p_status: status,
    p_request_number: String(formData.get('requestNumber') ?? '') || null,
    p_submission_date: String(formData.get('submissionDate') ?? '') || null,
    p_service_type: String(formData.get('serviceType') ?? '') || null,
    p_return_notes: String(formData.get('returnNotes') ?? '') || null,
    p_accreditation_number: String(formData.get('accreditationNumber') ?? '') || null,
    p_approved_hours: approvedHoursRaw ? Number(approvedHoursRaw) : null,
    p_decision_date: String(formData.get('decisionDate') ?? '') || null,
    p_evidence_reference: String(formData.get('evidenceReference') ?? '') || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/external');
  revalidatePath('/dashboard');
}
