import Link from 'next/link';
import type { ReactNode } from 'react';
import { roleHasPermission } from '@/lib/auth/permissions';
import { requireServerAuthContext } from '@/lib/auth/server-context';

export default async function AdminLayout({children}:{children:ReactNode}){
  const c=await requireServerAuthContext(); const can=(p:Parameters<typeof roleHasPermission>[1])=>roleHasPermission(c.activeRole,p);
  const links=[
    can('activity.create')&&['/admin','الأنشطة'],can('organization.users.manage')&&['/admin/users','المستخدمون والأدوار'],can('committee.manage_structure')&&['/admin/committee','اللجنة المؤسسية'],
    can('ai.manage_references')&&['/admin/references','المراجع والقواعد'],(can('template.manage')||can('template.approve'))&&['/admin/templates','القوالب والإصدارات'],
    (c.activeRole==='ORGANIZATION_SYSTEM_ADMIN'||c.activeRole==='MANAGEMENT_APPROVER')&&['/admin/ai-settings','خصوصية وExternal AI'],
  ].filter(Boolean) as string[][];
  return <div className="space-y-4"><nav className="no-print flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="إدارة النظام">{links.map(([href,label])=><Link key={href} href={href} className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-900">{label}</Link>)}</nav>{children}</div>;
}
