import Link from 'next/link';
import { SecretaryWorkspace } from '@/features/committee/secretary-workspace';
import { getCommitteeGovernanceWorkspace } from '@/features/committee/queries';
import { requireServerAuthContext } from '@/lib/auth/server-context';

export default async function CommitteeSecretaryPage(){
  const context=await requireServerAuthContext('committee.prepare');
  const workspace=await getCommitteeGovernanceWorkspace(context.organizationId);
  return <section className="space-y-6">
    <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-teal-800">Committee Secretary</p><h1 className="mt-2 text-3xl font-black">مساحة عمل سكرتير اللجنة</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">تجهيز الاجتماعات والحضور وفتح المراجعات وتوثيق النتيجة الجماعية. السكرتير لا يملك قرار الموافقة النهائي.</p></header>
    {!workspace.committee?<div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">لا توجد لجنة مؤسسية نشطة. يجب على مسؤول النظام تسجيل قرار التشكيل أولًا.</div>:<SecretaryWorkspace members={workspace.members} meetings={workspace.meetings} readyActivities={workspace.readyActivities}/>} 
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black">المراجعات الأخيرة</h2><div className="mt-4 grid gap-2">{workspace.reviews.length===0?<p className="text-sm text-slate-500">لا توجد مراجعات.</p>:workspace.reviews.map(r=><Link key={String(r.id)} href={`/committee/reviews/${String(r.id)}`} className="flex flex-wrap justify-between gap-3 rounded-xl bg-slate-50 p-4 text-sm hover:bg-slate-100"><span className="font-bold">{String((r.activity as Record<string,unknown>|null)?.title_ar ?? 'Activity')}</span><span>{String(r.status)}</span></Link>)}</div></section>
  </section>;
}
