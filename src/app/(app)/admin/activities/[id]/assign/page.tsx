import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActivityAssignForm } from '@/features/activities/activity-assign-form';
import {
  listAssignableActivityOfficers,
  listVisibleActivities,
} from '@/features/activities/queries';
import { requireServerAuthContext } from '@/lib/auth/server-context';

export default async function AssignActivityOfficerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireServerAuthContext('activity.assign');
  const [activities, officers] = await Promise.all([
    listVisibleActivities(context.organizationId),
    listAssignableActivityOfficers(context.organizationId),
  ]);
  const activity = activities.find((item) => item.id === id);

  if (!activity) notFound();

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/admin" className="font-bold text-teal-800 hover:underline">
          إدارة الأنشطة
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-500">إسناد مسؤول النشاط</span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="rounded-xl bg-slate-50 p-5">
          <div className="font-mono text-xs font-bold text-slate-500" dir="ltr">
            {activity.activityCode}
          </div>
          <h1 className="mt-2 text-2xl font-black text-slate-950">{activity.titleAr}</h1>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            اختر مستخدمًا يحمل دور مسؤول النشاط داخل المؤسسة الحالية. قاعدة البيانات تتحقق من العضوية والدور مرة أخرى عند الحفظ.
          </p>
        </div>

        <div className="mt-7">
          <ActivityAssignForm activityId={activity.id} officers={officers} />
        </div>
      </div>
    </section>
  );
}
