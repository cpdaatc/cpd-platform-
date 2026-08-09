import Link from 'next/link';
import { ActivityCreateForm } from '@/features/activities/activity-create-form';
import { requireServerAuthContext } from '@/lib/auth/server-context';

export default async function NewActivityPage() {
  await requireServerAuthContext('activity.create');

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/admin" className="font-bold text-teal-800 hover:underline">
          إدارة الأنشطة
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-500">نشاط جديد</span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-bold text-teal-800">Activity Master</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">إنشاء نشاط جديد</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          هذه الشاشة تنشئ السجل الرئيسي فقط. النموذج التفصيلي والـPDF والمسار الهجين ستُربط بهذا السجل في مرحلة Intake دون إعادة إدخال البيانات الأساسية.
        </p>

        <div className="mt-8">
          <ActivityCreateForm />
        </div>
      </div>
    </section>
  );
}
