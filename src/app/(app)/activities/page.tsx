import { notFound } from 'next/navigation';
import { ActivityDashboard } from '@/features/activity-dossier/activity-dashboard';
import { listActivityDossiers, type ActivityDossierRpc } from '@/features/activity-dossier/queries';
import { roleHasPermission } from '@/lib/auth/permissions';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function MyActivitiesPage() {
  const context = await requireServerAuthContext();
  const canList = roleHasPermission(context.activeRole, 'activity.view.all')
    || roleHasPermission(context.activeRole, 'activity.view.assigned');
  if (!canList) notFound();
  const supabase = await createServerSupabaseClient();
  const rpc: ActivityDossierRpc = async (name, args) => {
    const result = await supabase.rpc(name, args);
    return { data: result.data, error: result.error };
  };
  const activities = await listActivityDossiers(rpc, {
    organizationId: context.organizationId,
    activeRole: context.activeRole,
  }, { reportingYear: null, departmentId: null, search: '' });
  let annualReports: Array<{ id: string; reportingYear: number; status: string }> = [];
  if (roleHasPermission(context.activeRole, 'annual.view')) {
    const { data } = await supabase.from('annual_committee_reports')
      .select('id,reporting_year,status')
      .eq('organization_id', context.organizationId);
    annualReports = (data ?? []).map((row) => ({
      id: String(row.id), reportingYear: Number(row.reporting_year), status: String(row.status),
    }));
  }
  return <ActivityDashboard items={activities} annualReports={annualReports} activeRole={context.activeRole} />;
}
