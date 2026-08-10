'use server';

import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { getReadinessWorkspace } from '@/features/ai-review/queries';
import { runDeterministicPreReview } from '@/features/ai-review/rules-engine';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function runPreReviewAction(formData: FormData): Promise<void> {
  const context = await requireServerAuthContext('ai.run_prereview');
  const activityId = String(formData.get('activityId') ?? '');
  if (!activityId) redirect('/activities');

  const workspace = await getReadinessWorkspace(activityId, context.organizationId);
  const findings = runDeterministicPreReview(workspace.input);
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(workspace.input))
    .digest('hex');

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc('save_pre_review_server_command', {
    p_organization_id: context.organizationId,
    p_actor_user_id: context.userId,
    p_role_context: context.activeRole,
    p_activity_id: activityId,
    p_ruleset_version: 'ruleset-1.0',
    p_input_fingerprint: fingerprint,
    p_findings: findings,
  });
  if (error) redirect(`/activities/${activityId}/readiness?error=1`);
  redirect(`/activities/${activityId}/readiness?reviewed=1`);
}
