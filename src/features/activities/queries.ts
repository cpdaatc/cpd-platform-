import { createServerSupabaseClient } from '@/lib/supabase/server';

export type ActivityListItem = {
  id: string;
  activityCode: string;
  titleAr: string;
  titleEn: string | null;
  reportingYear: number;
  internalState: string;
  plannedStartDate: string | null;
};

export type AssignableOfficer = {
  membershipId: string;
  userId: string;
  displayName: string;
};

export async function listVisibleActivities(
  organizationId: string,
): Promise<ActivityListItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('activities')
    .select('id, activity_code, title_ar, title_en, reporting_year, internal_state, planned_start_date')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Unable to load activities.');
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    activityCode: String(row.activity_code),
    titleAr: String(row.title_ar),
    titleEn: row.title_en ? String(row.title_en) : null,
    reportingYear: Number(row.reporting_year),
    internalState: String(row.internal_state),
    plannedStartDate: row.planned_start_date ? String(row.planned_start_date) : null,
  }));
}

export async function listAssignableActivityOfficers(
  organizationId: string,
): Promise<AssignableOfficer[]> {
  const supabase = await createServerSupabaseClient();

  const { data: roleRow, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('code', 'ACTIVITY_OFFICER')
    .maybeSingle();

  if (roleError || !roleRow) {
    throw new Error('Activity Officer role is not configured.');
  }

  const { data: userRoleRows, error: userRoleError } = await supabase
    .from('user_roles')
    .select('membership_id')
    .eq('organization_id', organizationId)
    .eq('role_id', roleRow.id);

  if (userRoleError) {
    throw new Error('Unable to load Activity Officer role assignments.');
  }

  const membershipIds = [...new Set((userRoleRows ?? []).map((row) => String(row.membership_id)))];
  if (membershipIds.length === 0) return [];

  const { data: memberships, error: membershipError } = await supabase
    .from('organization_memberships')
    .select('id, user_id')
    .eq('organization_id', organizationId)
    .eq('status', 'ACTIVE')
    .in('id', membershipIds);

  if (membershipError) {
    throw new Error('Unable to load active Activity Officer memberships.');
  }

  const userIds = [...new Set((memberships ?? []).map((row) => String(row.user_id)))];
  if (userIds.length === 0) return [];

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, display_name')
    .in('id', userIds);

  if (usersError) {
    throw new Error('Unable to load Activity Officer identities.');
  }

  const names = new Map(
    (users ?? []).map((row) => [String(row.id), row.display_name ? String(row.display_name) : 'مستخدم بدون اسم عرض']),
  );

  return (memberships ?? [])
    .map((row) => ({
      membershipId: String(row.id),
      userId: String(row.user_id),
      displayName: names.get(String(row.user_id)) ?? 'مستخدم بدون اسم عرض',
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ar'));
}
