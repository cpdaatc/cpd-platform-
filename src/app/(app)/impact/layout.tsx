import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireServerAuthContext } from '@/lib/auth/server-context';

export default async function ImpactLayout({children}:{children:ReactNode}){
  const c=await requireServerAuthContext('impact.view');
  const showCorrections=['ORGANIZATION_SYSTEM_ADMIN','ACTIVITY_OFFICER','MANAGEMENT_APPROVER'].includes(c.activeRole);
  return <div className="space-y-4"><nav className="no-print flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="قياس الأثر"><Link href="/impact" className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-teal-50">لوحة الأثر</Link>{showCorrections?<Link href="/impact/corrections" className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-teal-50">تصحيحات التقارير النهائية</Link>:null}<Link href="/reports" className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-teal-50">التقارير والطباعة</Link></nav>{children}</div>;
}
