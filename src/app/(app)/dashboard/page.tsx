import Link from 'next/link';
import { ROLE_LABELS_AR } from '@/lib/auth/labels';
import { roleHasPermission } from '@/lib/auth/permissions';
import { requireServerAuthContext } from '@/lib/auth/server-context';

export default async function DashboardPage() {
  const context = await requireServerAuthContext();
  const canCreate = roleHasPermission(context.activeRole, 'activity.create');
  const canViewAssigned = roleHasPermission(context.activeRole, 'activity.view.assigned');

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-bold text-teal-800">لوحة العمل</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">
          {ROLE_LABELS_AR[context.activeRole]}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          تعرض هذه المساحة الوظائف المسموح بها للدور النشط فقط. امتلاك أدوار إضافية في الحساب لا يدمج صلاحياتها مع هذا السياق.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {canCreate ? (
          <Link
            href="/admin"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-teal-700"
          >
            <span className="text-xs font-bold text-teal-800">SYSTEM ADMIN</span>
            <h2 className="mt-2 text-xl font-black text-slate-950">إدارة الأنشطة والإسناد</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              إنشاء نشاط مؤسسي جديد، توليد رقمه، ثم إسناده لمسؤول نشاط مخول.
            </p>
          </Link>
        ) : null}

        {canViewAssigned ? (
          <Link
            href="/activities"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-teal-700"
          >
            <span className="text-xs font-bold text-teal-800">ACTIVITY OFFICER</span>
            <h2 className="mt-2 text-xl font-black text-slate-950">أنشطتي</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              عرض الأنشطة المسندة إلى حسابك فقط. تجهيز نموذج النشاط يُضاف في Phase 2.
            </p>
          </Link>
        ) : null}
      </div>

      {!canCreate && !canViewAssigned ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
          تم تفعيل الهوية والصلاحيات لهذا الدور في طبقة الأساس. وظائف المراجعة العلمية والمحاضر والتقارير ستظهر عند تنفيذ الموديول المخصص لها دون منح صلاحيات مؤقتة غير معتمدة.
        </div>
      ) : null}
    </section>
  );
}
