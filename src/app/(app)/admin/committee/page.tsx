import { CommitteeSetupForm } from '@/features/committee/committee-setup-form';
import { getCommitteeGovernanceWorkspace, getOrganizationPeople } from '@/features/committee/queries';
import { requireServerAuthContext } from '@/lib/auth/server-context';

export default async function AdminCommitteePage(){
  const context=await requireServerAuthContext('committee.manage_structure');
  const [people,workspace]=await Promise.all([getOrganizationPeople(context.organizationId),getCommitteeGovernanceWorkspace(context.organizationId)]);
  return <section className="space-y-6">
    <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-teal-800">System Administration</p><h1 className="mt-2 text-3xl font-black">تشكيل اللجنة العلمية المؤسسية</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">يسجل مسؤول النظام قرار التعيين المعتمد؛ لا يختار أعضاء اللجنة من تلقاء نفسه، ولا يمنحه هذا الدور سلطة القرار العلمي.</p></header>
    {workspace.committee ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm"><strong>اللجنة النشطة:</strong> {String(workspace.committee.committee_name)} · {String(workspace.committee.appointment_reference)} · الأعضاء {workspace.members.length}</div> : null}
    <CommitteeSetupForm people={people}/>
  </section>;
}
