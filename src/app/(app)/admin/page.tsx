import Link from 'next/link';
import { listVisibleActivities } from '@/features/activities/queries';
import { getInternalStateLabel } from '@/features/activities/status-labels';
import { requireServerAuthContext } from '@/lib/auth/server-context';

export default async function SystemAdminPage() {
  const context = await requireServerAuthContext('activity.create');
  const activities = await listVisibleActivities(context.organizationId);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-bold text-teal-800">مسؤول النظام المؤسسي</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">إدارة الأنشطة</h1>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            إنشاء السجل الرئيسي للنشاط وإسناده للمستخدم المخول. القرار العلمي ليس ضمن صلاحيات مسؤول النظام.
          </p>
        </div>
        <Link
          href="/admin/activities/new"
          className="rounded-xl bg-teal-800 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-900"
        >
          إنشاء نشاط جديد
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-black text-slate-950">سجل الأنشطة</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {activities.length} نشاط
          </span>
        </div>

        {activities.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            لا توجد أنشطة مسجلة بعد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-right text-xs font-bold text-slate-600">
                <tr>
                  <th className="px-5 py-3">رقم النشاط</th>
                  <th className="px-5 py-3">اسم النشاط</th>
                  <th className="px-5 py-3">السنة</th>
                  <th className="px-5 py-3">الحالة الداخلية</th>
                  <th className="px-5 py-3">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activities.map((activity) => (
                  <tr key={activity.id} className="align-top">
                    <td className="px-5 py-4 font-mono text-xs font-bold text-slate-700" dir="ltr">
                      {activity.activityCode}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-950">{activity.titleAr}</div>
                      {activity.titleEn ? (
                        <div className="mt-1 text-xs text-slate-500" dir="ltr">{activity.titleEn}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-slate-700">{activity.reportingYear}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-900">
                        {getInternalStateLabel(activity.internalState)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/activities/${activity.id}/assign`}
                        className="font-bold text-teal-800 hover:underline"
                      >
                        إسناد مسؤول النشاط
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
