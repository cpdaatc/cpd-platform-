import { redirect } from 'next/navigation';
import {
  AuthenticationRequiredError,
  getServerAuthState,
} from '@/lib/auth/server-context';
import { ROLE_LABELS_AR } from '@/lib/auth/labels';
import { selectOrganizationAction, selectRoleAction } from './actions';

export default async function ContextPage() {
  let state;
  try {
    state = await getServerAuthState();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect('/login');
    }
    throw error;
  }

  if (state.organizationId && state.activeRole) {
    redirect('/dashboard');
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-12">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <p className="text-sm font-bold text-teal-800">سياق العمل</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">حدد المؤسسة والدور</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          إذا كان حسابك يحمل أكثر من مسؤولية، تبقى الصلاحيات منفصلة. كل إجراء يُسجل بالدور الذي استخدمته لتنفيذه.
        </p>

        {state.organizations.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
            الحساب موثق، لكنه غير مرتبط حاليًا بمؤسسة نشطة. يجب على مسؤول مخول إضافة العضوية قبل استخدام المنصة.
          </div>
        ) : null}

        {state.requiresOrganizationSelection && state.organizations.length > 0 ? (
          <div className="mt-8">
            <h2 className="text-lg font-black text-slate-900">المؤسسة</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {state.organizations.map((organization) => (
                <form action={selectOrganizationAction} key={organization.id}>
                  <input type="hidden" name="organizationId" value={organization.id} />
                  <button
                    type="submit"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 text-right transition hover:border-teal-700 hover:bg-teal-50"
                  >
                    <span className="block font-black text-slate-950">{organization.name}</span>
                    <span className="mt-1 block text-xs text-slate-500" dir="ltr">{organization.slug}</span>
                  </button>
                </form>
              ))}
            </div>
          </div>
        ) : null}

        {!state.requiresOrganizationSelection && state.organizationId && state.requiresRoleSelection ? (
          <div className="mt-8">
            <h2 className="text-lg font-black text-slate-900">الدور الحالي</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {state.assignedRoles.map((role) => (
                <form action={selectRoleAction} key={role}>
                  <input type="hidden" name="role" value={role} />
                  <button
                    type="submit"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 text-right transition hover:border-teal-700 hover:bg-teal-50"
                  >
                    <span className="block font-black text-slate-950">{ROLE_LABELS_AR[role]}</span>
                    <span className="mt-1 block text-xs font-medium text-slate-500" dir="ltr">{role}</span>
                  </button>
                </form>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
