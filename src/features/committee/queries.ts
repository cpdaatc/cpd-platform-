import { createServerSupabaseClient } from '@/lib/supabase/server';

type Row = Record<string, unknown>;

export async function getOrganizationPeople(organizationId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: memberships, error } = await supabase
    .from('organization_memberships')
    .select('id,user_id')
    .eq('organization_id', organizationId)
    .eq('status','ACTIVE');
  if (error) throw new Error('Unable to load organization members.');
  const userIds=(memberships ?? []).map((row)=>String(row.user_id));
  const { data: users, error: usersError } = userIds.length
    ? await supabase.from('users').select('id,display_name').in('id',userIds)
    : { data: [] as Array<{id:string;display_name:string}>, error: null };
  if (usersError) throw new Error('Unable to load user profiles.');
  const names=new Map((users ?? []).map((user)=>[String(user.id),String(user.display_name)]));
  return (memberships ?? []).map((row)=>({ membershipId:String(row.id), userId:String(row.user_id), displayName:names.get(String(row.user_id)) ?? 'User' }));
}

export async function getCommitteeGovernanceWorkspace(organizationId: string) {
  const supabase = await createServerSupabaseClient();
  const [committeeResult, readyResult, meetingsResult, reviewsResult, minutesResult] = await Promise.all([
    supabase.from('institutional_committees').select('*').eq('organization_id',organizationId).eq('status','ACTIVE').maybeSingle(),
    supabase.from('activities').select('id,activity_code,title_ar,title_en,internal_state,latest_submitted_revision_id').eq('organization_id',organizationId).eq('internal_state','READY_FOR_COMMITTEE').order('updated_at'),
    supabase.from('committee_meetings').select('*').eq('organization_id',organizationId).order('scheduled_at',{ascending:false}).limit(20),
    supabase.from('committee_reviews').select('*').eq('organization_id',organizationId).order('recorded_at',{ascending:false}).limit(50),
    supabase.from('committee_minutes').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(50),
  ]);
  const committee=committeeResult.data as Row | null;
  const membersResult=committee?.id
    ? await supabase.from('institutional_committee_members').select('*').eq('organization_id',organizationId).eq('committee_id',committee.id).order('committee_role')
    : { data: [] as Row[], error: null };
  const activityIds=(reviewsResult.data ?? []).map((row)=>String(row.activity_id));
  const { data: reviewActivities, error: reviewActivitiesError }=activityIds.length
    ? await supabase.from('activities').select('id,activity_code,title_ar,title_en,internal_state').eq('organization_id',organizationId).in('id',activityIds)
    : { data: [] as Row[], error:null };
  const activityById=new Map((reviewActivities ?? []).map((row)=>[String(row.id),row as Row]));
  const errors=[committeeResult.error,readyResult.error,meetingsResult.error,reviewsResult.error,minutesResult.error,membersResult.error,reviewActivitiesError].filter(Boolean);
  if(errors.length) throw new Error('Unable to load committee governance workspace.');
  return {
    committee,
    members:(membersResult.data ?? []) as Row[],
    readyActivities:(readyResult.data ?? []) as Row[],
    meetings:(meetingsResult.data ?? []) as Row[],
    reviews:(reviewsResult.data ?? []).map((row)=>({...row,activity:activityById.get(String(row.activity_id)) ?? null})) as Row[],
    minutes:(minutesResult.data ?? []) as Row[],
  };
}

export async function getCommitteeReviewWorkspace(reviewId: string, organizationId: string) {
  const supabase=await createServerSupabaseClient();
  const { data: review, error }=await supabase.from('committee_reviews').select('*').eq('id',reviewId).eq('organization_id',organizationId).single();
  if(error || !review) throw new Error('Committee review is not available.');
  const [activityResult,revisionResult,meetingResult,resultsResult,commentsResult,decisionResult,minutesResult]=await Promise.all([
    supabase.from('activities').select('id,activity_code,title_ar,title_en,internal_state').eq('id',review.activity_id).eq('organization_id',organizationId).single(),
    supabase.from('activity_revisions').select('id,revision_no,status,snapshot_sha256,submitted_at,change_summary').eq('id',review.revision_id).eq('organization_id',organizationId).single(),
    review.meeting_id ? supabase.from('committee_meetings').select('*').eq('id',review.meeting_id).eq('organization_id',organizationId).single() : Promise.resolve({data:null,error:null}),
    supabase.from('committee_standard_results').select('*').eq('review_id',reviewId).eq('organization_id',organizationId).order('criterion_code'),
    supabase.from('committee_comments').select('*').eq('review_id',reviewId).eq('organization_id',organizationId).order('commented_at'),
    supabase.from('committee_decisions').select('*').eq('review_id',reviewId).eq('organization_id',organizationId).maybeSingle(),
    supabase.from('committee_minutes').select('*').eq('review_id',reviewId).eq('organization_id',organizationId).order('version_no',{ascending:false}),
  ]);
  const errors=[activityResult.error,revisionResult.error,meetingResult.error,resultsResult.error,commentsResult.error,decisionResult.error,minutesResult.error].filter(Boolean);
  if(errors.length) throw new Error('Unable to load committee review details.');
  return {review:review as Row,activity:activityResult.data as Row,revision:revisionResult.data as Row,meeting:meetingResult.data as Row|null,results:(resultsResult.data ?? []) as Row[],comments:(commentsResult.data ?? []) as Row[],decision:decisionResult.data as Row|null,minutes:(minutesResult.data ?? []) as Row[]};
}
