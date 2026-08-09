import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { PreReviewInput } from './rules-engine';

export type ReadinessWorkspace = {
  activity: { id: string; activityCode: string; titleAr: string; titleEn: string | null };
  input: PreReviewInput;
  objectives: Array<{ id: string; objectiveText: string; learningDomain: string | null }>;
  latestReview: Record<string, unknown> | null;
  findings: Array<Record<string, unknown>>;
  externalAiPolicy: {
    externalAiEnabled: boolean;
    privacyApproved: boolean;
    provider: string | null;
    processingRegion: string | null;
  };
  openSourceConflicts: number;
};

export async function getReadinessWorkspace(activityId: string): Promise<ReadinessWorkspace> {
  const supabase = await createServerSupabaseClient();
  const { data: activity, error: activityError } = await supabase
    .from('activities')
    .select('id,activity_code,title_ar,title_en')
    .eq('id', activityId)
    .single();
  if (activityError || !activity) throw new Error('Activity is not available.');

  const [profileResult, committeeResult, objectivesResult, speakersResult, disclosuresResult, latestReviewResult, policyResult, conflictsResult] = await Promise.all([
    supabase.from('activity_intake_profiles').select('learning_gap,learning_methods,participant_evaluation_method').eq('activity_id', activityId).maybeSingle(),
    supabase.from('activity_scientific_committees').select('id').eq('activity_id', activityId).maybeSingle(),
    supabase.from('activity_learning_objectives').select('id,objective_text,learning_domain').eq('activity_id', activityId).order('sort_order'),
    supabase.from('activity_speakers').select('id').eq('activity_id', activityId),
    supabase.from('disclosure_records').select('declaration_status').eq('activity_id', activityId),
    supabase.from('ai_reviews').select('*').eq('activity_id', activityId).eq('review_type','PRE_REVIEW').order('completed_at',{ ascending:false }).limit(1),
    supabase.from('organization_ai_settings').select('external_ai_enabled,privacy_approved,provider,processing_region').limit(1).maybeSingle(),
    supabase.from('source_conflicts').select('id',{ count:'exact', head:true }).eq('status','OPEN'),
  ]);

  const committeeId = committeeResult.data?.id ? String(committeeResult.data.id) : null;
  const committeeMembersResult = committeeId
    ? await supabase.from('activity_scientific_committee_members').select('id').eq('activity_scientific_committee_id', committeeId)
    : { data: [] as Array<{ id: string }>, error: null };

  const speakerIds = (speakersResult.data ?? []).map((speaker) => String(speaker.id));
  const speakerDocumentsResult = speakerIds.length > 0
    ? await supabase.from('activity_speaker_documents').select('activity_speaker_id').in('activity_speaker_id', speakerIds).eq('document_type','CV')
    : { data: [] as Array<{ activity_speaker_id: string }>, error: null };

  const latestReview = latestReviewResult.data?.[0] ?? null;
  const findingsResult = latestReview
    ? await supabase.from('ai_findings').select('*').eq('ai_review_id', latestReview.id).order('severity')
    : { data: [] as Array<Record<string, unknown>>, error: null };

  const errors = [
    profileResult.error, committeeResult.error, objectivesResult.error, speakersResult.error,
    disclosuresResult.error, latestReviewResult.error, policyResult.error, conflictsResult.error,
    committeeMembersResult.error, speakerDocumentsResult.error, findingsResult.error,
  ].filter(Boolean);
  if (errors.length > 0) throw new Error('Unable to load readiness workspace.');

  const cvSpeakerIds = new Set((speakerDocumentsResult.data ?? []).map((row) => String(row.activity_speaker_id)));
  const objectives = (objectivesResult.data ?? []).map((row) => ({
    id: String(row.id),
    objectiveText: String(row.objective_text),
    learningDomain: row.learning_domain ? String(row.learning_domain) : null,
  }));

  return {
    activity: {
      id: String(activity.id),
      activityCode: String(activity.activity_code),
      titleAr: String(activity.title_ar),
      titleEn: activity.title_en ? String(activity.title_en) : null,
    },
    input: {
      committeeMemberCount: committeeMembersResult.data?.length ?? 0,
      learningGap: profileResult.data?.learning_gap ? String(profileResult.data.learning_gap) : '',
      objectives: objectives.map((objective) => objective.objectiveText),
      learningMethods: profileResult.data?.learning_methods ? String(profileResult.data.learning_methods) : '',
      evaluationMethod: profileResult.data?.participant_evaluation_method ? String(profileResult.data.participant_evaluation_method) : '',
      speakerCount: speakerIds.length,
      speakerCvCount: cvSpeakerIds.size,
      disclosureStatuses: (disclosuresResult.data ?? []).map((row) => String(row.declaration_status)),
    },
    objectives,
    latestReview: (latestReview as Record<string, unknown> | null) ?? null,
    findings: (findingsResult.data ?? []) as Array<Record<string, unknown>>,
    externalAiPolicy: {
      externalAiEnabled: policyResult.data?.external_ai_enabled === true,
      privacyApproved: policyResult.data?.privacy_approved === true,
      provider: policyResult.data?.provider ? String(policyResult.data.provider) : null,
      processingRegion: policyResult.data?.processing_region ? String(policyResult.data.processing_region) : null,
    },
    openSourceConflicts: conflictsResult.count ?? 0,
  };
}
