import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DossierSections } from '@/features/activity-dossier/dossier-sections';
import { getActivityDossier, type ActivityDossierRpc } from '@/features/activity-dossier/queries';
import { roleHasPermission } from '@/lib/auth/permissions';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function ActivityDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireServerAuthContext();
  const canRead = roleHasPermission(context.activeRole, 'activity.view.all')
    || roleHasPermission(context.activeRole, 'activity.view.assigned');
  if (!canRead) notFound();
  const supabase = await createServerSupabaseClient();
  const rpc: ActivityDossierRpc = async (name, args) => {
    const result = await supabase.rpc(name, args);
    return { data: result.data, error: result.error };
  };
  let dossier;
  try {
    dossier = await getActivityDossier(rpc, {
      organizationId: context.organizationId,
      activeRole: context.activeRole,
    }, id);
  } catch {
    notFound();
  }
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/activities" className="text-xs font-black text-teal-800">← العودة إلى سجل الأنشطة</Link><h1 className="mt-2 text-2xl font-black">{dossier.activity.titleAr}</h1>{dossier.activity.titleEn ? <p className="text-xs text-slate-500" dir="ltr">{dossier.activity.titleEn}</p> : null}</div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">ملف محكوم v{dossier.contractVersion}</span></div>
    <DossierSections dossier={dossier} canUpload={roleHasPermission(context.activeRole, 'activity.fill_submit')} canManageImpact={roleHasPermission(context.activeRole, 'impact.manage')} />
  </section>;
}
