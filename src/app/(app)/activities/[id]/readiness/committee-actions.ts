'use server';

import { redirect } from 'next/navigation';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function submitToCommitteeAction(formData: FormData): Promise<void> {
  const context = await requireServerAuthContext('activity.submit_committee');
  const activityId = String(formData.get('activityId') ?? '');
  const changeSummary = String(formData.get('changeSummary') ?? '').trim();
  if (!activityId) redirect('/activities');

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc('submit_activity_revision_command', {
    p_organization_id: context.organizationId,
    p_role_context: context.activeRole,
    p_activity_id: activityId,
    p_change_summary: changeSummary || null,
  });
  if (error) redirect(`/activities/${activityId}/readiness?submitError=1`);
  redirect(`/activities/${activityId}/readiness?submitted=1`);
}
