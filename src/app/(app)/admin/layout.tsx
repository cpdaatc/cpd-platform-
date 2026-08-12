import type { ReactNode } from 'react';
import { SectionTabs } from '@/components/section-tabs';
import { roleHasPermission } from '@/lib/auth/permissions';
import { requireServerAuthContext } from '@/lib/auth/server-context';

export default async function AdminLayout({children}:{children:ReactNode}){
  const c=await requireServerAuthContext(); const can=(p:Parameters<typeof roleHasPermission>[1])=>roleHasPermission(c.activeRole,p);
  const links=[
    can('activity.create')&&{href:'/admin',label:'الأنشطة',exact:true},can('organization.users.manage')&&{href:'/admin/users',label:'المستخدمون والأدوار'},can('committee.manage_structure')&&{href:'/admin/committee',label:'اللجنة المؤسسية'},
    can('ai.manage_references')&&{href:'/admin/references',label:'المراجع والقواعد'},(can('template.manage')||can('template.approve'))&&{href:'/admin/templates',label:'القوالب والإصدارات'},
    (can('ai.settings.configure')||can('ai.settings.approve'))&&{href:'/admin/ai-settings',label:'خصوصية وExternal AI'},
  ].filter(Boolean) as {href:string;label:string;exact?:boolean}[];
  return <div className="space-y-4"><SectionTabs links={links} ariaLabel="إدارة النظام"/>{children}</div>;
}
