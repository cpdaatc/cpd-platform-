import Link from 'next/link';
import { listVisibleActivities } from '@/features/activities/queries';
import { getInternalStateLabel } from '@/features/activities/status-labels';
import { requireServerAuthContext } from '@/lib/auth/server-context';

export default async function MyActivitiesPage() {
  const context = await requireServerAuthContext('activity.view.assigned');
  const activities = await listVisibleActivities(context.organizationId);

  return <section className="space-y-6">
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-black uppercase tracking-[.18em] text-teal-700">Activity Officer Workspace</p><h1 className="mt-2 text-3xl font-black text-slate-950">أنشطتي</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">تظهر فقط الأنشطة المسندة إلى عضويتك الحالية. من هنا تبدأ التعبئة الرقمية/PDF، Planning Assistant، معاينة القالب الرسمي، ثم مراجعة الجاهزية قبل اللجنة.</p></div>
    <div className="grid gap-4">{activities.length===0?<div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">لا توجد أنشطة مسندة إليك حاليًا.</div>:activities.map(activity=><article key={activity.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="font-mono text-xs font-bold text-slate-500" dir="ltr">{activity.activityCode}</div><h2 className="mt-2 text-xl font-black text-slate-950">{activity.titleAr}</h2>{activity.titleEn?<p className="mt-1 text-xs text-slate-500" dir="ltr">{activity.titleEn}</p>:null}</div><span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-900">{getInternalStateLabel(activity.internalState)}</span></div><div className="mt-5 border-t border-slate-100 pt-4"><div className="flex flex-wrap gap-2"><Link href={`/activities/${activity.id}/intake`} className="rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-900">ملف النشاط</Link><Link href={`/activities/${activity.id}/planning-assistant`} className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-900">Planning Assistant</Link><Link href={`/activities/${activity.id}/intake/official-preview`} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800">Official Preview</Link><Link href={`/activities/${activity.id}/readiness`} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800">Pre‑Review</Link></div></div></article>)}</div>
  </section>;
}
