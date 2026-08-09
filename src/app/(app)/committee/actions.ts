'use server';

import { redirect } from 'next/navigation';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function configureInstitutionalCommitteeAction(formData: FormData): Promise<void> {
  const context=await requireServerAuthContext('committee.manage_structure');
  const membersJson=String(formData.get('membersJson') ?? '[]');
  let members: unknown;
  try { members=JSON.parse(membersJson); } catch { redirect('/admin/committee?error=members'); }
  const supabase=await createServerSupabaseClient();
  const { error }=await supabase.rpc('configure_institutional_committee_command',{
    p_organization_id:context.organizationId,p_role_context:context.activeRole,
    p_committee_name:String(formData.get('committeeName') ?? ''),p_appointment_reference:String(formData.get('appointmentReference') ?? ''),
    p_appointment_date:String(formData.get('appointmentDate') ?? '') || null,p_appointed_by:String(formData.get('appointedBy') ?? ''),
    p_effective_from:String(formData.get('effectiveFrom') ?? ''),p_effective_to:String(formData.get('effectiveTo') ?? '') || null,p_members:members,
  });
  if(error) redirect('/admin/committee?error=1');
  redirect('/admin/committee?saved=1');
}

export async function createMeetingAction(formData: FormData): Promise<void> {
  const context=await requireServerAuthContext('committee.prepare');
  const supabase=await createServerSupabaseClient();
  const { error }=await supabase.rpc('create_committee_meeting_command',{
    p_organization_id:context.organizationId,p_role_context:context.activeRole,
    p_scheduled_at:String(formData.get('scheduledAt') ?? ''),p_location_or_channel:String(formData.get('location') ?? ''),
    p_meeting_reference:String(formData.get('meetingReference') ?? '') || null,
  });
  if(error) redirect('/committee/secretary?meetingError=1');
  redirect('/committee/secretary?meetingCreated=1');
}

export async function recordAttendanceAction(formData: FormData): Promise<void> {
  const context=await requireServerAuthContext('committee.prepare');
  const meetingId=String(formData.get('meetingId') ?? '');
  let attendance: unknown=[];
  try { attendance=JSON.parse(String(formData.get('attendanceJson') ?? '[]')); } catch { redirect('/committee/secretary?attendanceError=1'); }
  const supabase=await createServerSupabaseClient();
  const { error }=await supabase.rpc('record_meeting_attendance_command',{
    p_organization_id:context.organizationId,p_role_context:context.activeRole,p_meeting_id:meetingId,p_attendance:attendance,
  });
  if(error) redirect('/committee/secretary?attendanceError=1');
  redirect('/committee/secretary?attendanceSaved=1');
}

export async function openReviewAction(formData: FormData): Promise<void> {
  const context=await requireServerAuthContext('committee.prepare');
  const activityId=String(formData.get('activityId') ?? ''); const meetingId=String(formData.get('meetingId') ?? '');
  const supabase=await createServerSupabaseClient();
  const { data,error }=await supabase.rpc('open_committee_review_command',{
    p_organization_id:context.organizationId,p_role_context:context.activeRole,p_activity_id:activityId,p_meeting_id:meetingId,
  });
  if(error || !data) redirect('/committee/secretary?reviewError=1');
  redirect(`/committee/reviews/${data}`);
}

export async function recordCollectiveAssessmentAction(formData: FormData): Promise<void> {
  const context=await requireServerAuthContext('committee.record_collective');
  const reviewId=String(formData.get('reviewId') ?? '');
  let results: unknown=[]; try { results=JSON.parse(String(formData.get('resultsJson') ?? '[]')); } catch { redirect(`/committee/reviews/${reviewId}?assessmentError=1`); }
  const supabase=await createServerSupabaseClient();
  const { error }=await supabase.rpc('record_collective_assessment_command',{
    p_organization_id:context.organizationId,p_role_context:context.activeRole,p_review_id:reviewId,p_results:results,
  });
  if(error) redirect(`/committee/reviews/${reviewId}?assessmentError=1`);
  redirect(`/committee/reviews/${reviewId}?assessmentSaved=1`);
}

export async function addCommitteeCommentAction(formData: FormData): Promise<void> {
  const context=await requireServerAuthContext('committee.comment'); const reviewId=String(formData.get('reviewId') ?? '');
  const supabase=await createServerSupabaseClient(); const { error }=await supabase.rpc('add_committee_comment_command',{
    p_organization_id:context.organizationId,p_role_context:context.activeRole,p_review_id:reviewId,p_comment:String(formData.get('comment') ?? ''),
  });
  if(error) redirect(`/committee/reviews/${reviewId}?commentError=1`); redirect(`/committee/reviews/${reviewId}?commented=1`);
}

export async function finalDecisionAction(formData: FormData): Promise<void> {
  const context=await requireServerAuthContext('activity.final_decision'); const reviewId=String(formData.get('reviewId') ?? '');
  const supabase=await createServerSupabaseClient(); const { error }=await supabase.rpc('final_committee_decision_command',{
    p_organization_id:context.organizationId,p_role_context:context.activeRole,p_review_id:reviewId,
    p_decision:String(formData.get('decision') ?? ''),p_decision_notes:String(formData.get('decisionNotes') ?? '') || null,
  });
  if(error) redirect(`/committee/reviews/${reviewId}?decisionError=1`); redirect(`/committee/reviews/${reviewId}?decided=1`);
}

export async function draftMinutesAction(formData: FormData): Promise<void> {
  const context=await requireServerAuthContext('minutes.draft'); const reviewId=String(formData.get('reviewId') ?? '');
  const supabase=await createServerSupabaseClient(); const { error }=await supabase.rpc('draft_committee_minutes_command',{
    p_organization_id:context.organizationId,p_role_context:context.activeRole,p_review_id:reviewId,
  });
  if(error) redirect(`/committee/reviews/${reviewId}?minutesError=1`); redirect(`/committee/reviews/${reviewId}?minutesDrafted=1`);
}

export async function finalizeMinutesAction(formData: FormData): Promise<void> {
  const context=await requireServerAuthContext('minutes.finalize'); const reviewId=String(formData.get('reviewId') ?? ''); const minutesId=String(formData.get('minutesId') ?? '');
  const supabase=await createServerSupabaseClient(); const { error }=await supabase.rpc('finalize_committee_minutes_command',{
    p_organization_id:context.organizationId,p_role_context:context.activeRole,p_minutes_id:minutesId,
  });
  if(error) redirect(`/committee/reviews/${reviewId}?finalizeError=1`); redirect(`/committee/reviews/${reviewId}?minutesFinal=1`);
}
