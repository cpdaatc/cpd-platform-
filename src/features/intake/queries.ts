import { createServerSupabaseClient } from '@/lib/supabase/server';

export type IntakeWorkspace = {
  activity: {
    id: string;
    activityCode: string;
    titleAr: string;
    titleEn: string | null;
    activityType: string | null;
    deliveryMethod: string | null;
    plannedStartDate: string | null;
    plannedEndDate: string | null;
  };
  profile: Record<string, unknown> | null;
  needsAssessmentTools: Array<Record<string, unknown>>;
  objectives: Array<Record<string, unknown>>;
  committeeMembers: Array<Record<string, unknown>>;
  speakers: Array<Record<string, unknown>>;
  sessions: Array<Record<string, unknown>>;
  disclosures: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  latestExtractionRun: Record<string, unknown> | null;
  extractionFields: Array<Record<string, unknown>>;
};

export async function getActivityIntakeWorkspace(activityId: string): Promise<IntakeWorkspace> {
  const supabase = await createServerSupabaseClient();

  const { data: activity, error: activityError } = await supabase
    .from('activities')
    .select('id, activity_code, title_ar, title_en, activity_type, delivery_method, planned_start_date, planned_end_date')
    .eq('id', activityId)
    .single();
  if (activityError || !activity) throw new Error('Activity is not available.');

  const [profileResult, needsResult, objectivesResult, committeeResult, speakersResult, sessionsResult, disclosuresResult, documentsResult, extractionRunsResult] = await Promise.all([
    supabase.from('activity_intake_profiles').select('*').eq('activity_id', activityId).maybeSingle(),
    supabase.from('activity_needs_assessment_tools').select('*').eq('activity_id', activityId).order('created_at'),
    supabase.from('activity_learning_objectives').select('*').eq('activity_id', activityId).order('sort_order'),
    supabase.from('activity_scientific_committees').select('id').eq('activity_id', activityId).maybeSingle(),
    supabase.from('activity_speakers').select('*').eq('activity_id', activityId).order('sort_order'),
    supabase.from('activity_sessions').select('*, session_speakers(activity_speaker_id)').eq('activity_id', activityId).order('sort_order'),
    supabase.from('disclosure_records').select('*').eq('activity_id', activityId).order('created_at'),
    supabase.from('intake_documents').select('id, document_role, original_filename, sha256, mime_type, file_size_bytes, uploaded_at').eq('activity_id', activityId).order('uploaded_at', { ascending: false }),
    supabase.from('extraction_runs').select('*').eq('activity_id', activityId).order('created_at', { ascending: false }).limit(1),
  ]);

  const committeeId = committeeResult.data?.id ? String(committeeResult.data.id) : null;
  const committeeMembersResult = committeeId
    ? await supabase.from('activity_scientific_committee_members').select('*').eq('activity_scientific_committee_id', committeeId).order('sort_order')
    : { data: [], error: null };

  const latestExtractionRun = extractionRunsResult.data?.[0] ?? null;
  const extractionFieldsResult = latestExtractionRun
    ? await supabase.from('extraction_field_results').select('*').eq('extraction_run_id', latestExtractionRun.id).order('field_key')
    : { data: [], error: null };

  const errors = [profileResult.error, needsResult.error, objectivesResult.error, committeeResult.error, speakersResult.error, sessionsResult.error, disclosuresResult.error, documentsResult.error, extractionRunsResult.error, committeeMembersResult.error, extractionFieldsResult.error].filter(Boolean);
  if (errors.length > 0) throw new Error('Unable to load activity intake workspace.');

  const speakerKeyById = new Map<string,string>();
  for (const speaker of speakersResult.data ?? []) {
    const id = String(speaker.id);
    const key = speaker.client_key ? String(speaker.client_key) : '';
    if (key) speakerKeyById.set(id,key);
  }

  const sessions = (sessionsResult.data ?? []).map((row) => {
    const links = Array.isArray(row.session_speakers) ? row.session_speakers : [];
    const speakerKeys = links
      .map((link) => speakerKeyById.get(String((link as { activity_speaker_id?: unknown }).activity_speaker_id ?? '')))
      .filter((value): value is string => Boolean(value));
    return { ...row, speaker_keys: speakerKeys } as Record<string, unknown>;
  });

  return {
    activity: {
      id: String(activity.id),
      activityCode: String(activity.activity_code),
      titleAr: String(activity.title_ar),
      titleEn: activity.title_en ? String(activity.title_en) : null,
      activityType: activity.activity_type ? String(activity.activity_type) : null,
      deliveryMethod: activity.delivery_method ? String(activity.delivery_method) : null,
      plannedStartDate: activity.planned_start_date ? String(activity.planned_start_date) : null,
      plannedEndDate: activity.planned_end_date ? String(activity.planned_end_date) : null,
    },
    profile: (profileResult.data as Record<string, unknown> | null) ?? null,
    needsAssessmentTools: (needsResult.data ?? []) as Array<Record<string, unknown>>,
    objectives: (objectivesResult.data ?? []) as Array<Record<string, unknown>>,
    committeeMembers: (committeeMembersResult.data ?? []) as Array<Record<string, unknown>>,
    speakers: (speakersResult.data ?? []) as Array<Record<string, unknown>>,
    sessions,
    disclosures: (disclosuresResult.data ?? []) as Array<Record<string, unknown>>,
    documents: (documentsResult.data ?? []) as Array<Record<string, unknown>>,
    latestExtractionRun: (latestExtractionRun as Record<string, unknown> | null) ?? null,
    extractionFields: (extractionFieldsResult.data ?? []) as Array<Record<string, unknown>>,
  };
}
