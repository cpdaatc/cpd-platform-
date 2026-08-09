import Link from 'next/link';
import type { ReactNode } from 'react';
import { logoutAction } from '@/app/login/actions';
import { resetContextAction, selectRoleAction } from '@/app/context/actions';
import { ROLE_LABELS_AR } from '@/lib/auth/labels';
import { roleHasPermission } from '@/lib/auth/permissions';
import type { RequiredServerAuthContext } from '@/lib/auth/server-context';

export function AppShell({
  context,
  children,
}: {
  context: RequiredServerAuthContext;
  children: ReactNode;
}) {
  const organization = context.organizations.find((item) => item.id === context.organizationId);
  const canCreateActivities = roleHasPermission(context.activeRole, 'activity.create');
  const canViewAssigned = roleHasPermission(context.activeRole, 'activity.view.assigned');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex h-11 min-w-16 items-center justify-center rounded-xl bg-teal-900 px-3 font-black tracking-wider text-white"
              aria-label="الصفحة الرئيسية"
            >
              CPD
            </Link>
            <div>
              <p className="text-sm font-black text-slate-950">حوكمة التطوير المهني المستمر</p>
              <p className="mt-0.5 text-xs text-slate-500">{organization?.name ?? 'المؤسسة الحالية'}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {context.assignedRoles.length > 1 ? (
              <form action={selectRoleAction} className="flex items-center gap-2">
                <label htmlFor="shell-role" className="sr-only">الدور الحالي</label>
                <select
                  id="shell-role"
                  name="role"
                  defaultValue={context.activeRole}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                >
                  {context.assignedRoles.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS_AR[role]}
                    </option>
                  ))}
                </select>
                <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  تبديل الدور
                </button>
              </form>
            ) : (
              <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-900">
                {ROLE_LABELS_AR[context.activeRole]}
              </span>
            )}

            {context.organizations.length > 1 ? (
              <form action={resetContextAction}>
                <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  تغيير المؤسسة
                </button>
              </form>
            ) : null}

            <form action={logoutAction}>
              <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                تسجيل الخروج
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <nav className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="التنقل الرئيسي">
          <div className="space-y-1">
            <Link href="/dashboard" className="block rounded-xl px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              نظرة عامة
            </Link>
            {canCreateActivities ? (
              <Link href="/admin" className="block rounded-xl px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                إدارة الأنشطة
              </Link>
            ) : null}
            {canViewAssigned ? (
              <Link href="/activities" className="block rounded-xl px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                أنشطتي
              </Link>
            ) : null}
          </div>
          <div className="mt-4 border-t border-slate-100 px-4 pt-4 text-xs leading-6 text-slate-500">
            الدور النشط: <strong className="text-slate-700">{ROLE_LABELS_AR[context.activeRole]}</strong>
          </div>
        </nav>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
