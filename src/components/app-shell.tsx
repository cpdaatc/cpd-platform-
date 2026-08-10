import Link from 'next/link';
import type { ReactNode } from 'react';
import { logoutAction } from '@/app/login/actions';
import { resetContextAction, selectRoleAction } from '@/app/context/actions';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageToggle } from '@/components/language-toggle';
import { NavIcon, type NavIconName } from '@/components/nav-icon';
import { ROLE_LABELS_AR, ROLE_LABELS_EN } from '@/lib/auth/labels';
import { roleHasPermission } from '@/lib/auth/permissions';
import type { RequiredServerAuthContext } from '@/lib/auth/server-context';
import type { UiLocale } from '@/lib/ui/locale';

function NavItem({href,icon,label}:{href:string;icon:NavIconName;label:string}){
  return <Link href={href} className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-teal-50 hover:text-teal-950 lg:w-full">
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-teal-800"><NavIcon name={icon}/></span><span>{label}</span>
  </Link>;
}

export function AppShell({context,locale,children}:{context:RequiredServerAuthContext;locale:UiLocale;children:ReactNode}){
  const ar=locale==='ar'; const t=(a:string,e:string)=>ar?a:e;
  const organization=context.organizations.find(item=>item.id===context.organizationId);
  const can=(permission:Parameters<typeof roleHasPermission>[1])=>roleHasPermission(context.activeRole,permission);
  const roleLabel=ar?ROLE_LABELS_AR[context.activeRole]:ROLE_LABELS_EN[context.activeRole];

  return <div className="app-shell min-h-screen bg-[#f4f8f7]" dir={ar?'rtl':'ltr'}>
    <header className="app-shell-header no-print sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3" aria-label={t('الصفحة الرئيسية','Home')}>
          <BrandLogo className="h-12 w-14 shrink-0 rounded-xl bg-white"/>
          <div className="min-w-0"><p className="truncate text-sm font-black text-[#123f40]">{t('منصة التطوير المهني المستمر','CPD Governance Platform')}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{organization?.name??t('المؤسسة الحالية','Current organization')}</p></div>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageToggle locale={locale}/>
          {context.assignedRoles.length>1?<form action={selectRoleAction} className="flex items-center gap-2"><label htmlFor="shell-role" className="sr-only">{t('الدور الحالي','Active role')}</label><select id="shell-role" name="role" defaultValue={context.activeRole} className="max-w-52 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800">{context.assignedRoles.map(role=><option key={role} value={role}>{ar?ROLE_LABELS_AR[role]:ROLE_LABELS_EN[role]}</option>)}</select><button className="hidden rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 sm:block">{t('تبديل الدور','Switch role')}</button></form>:<span className="hidden rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-900 sm:inline-flex">{roleLabel}</span>}
          {context.organizations.length>1?<form action={resetContextAction}><button className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">{t('المؤسسة','Organization')}</button></form>:null}
          <form action={logoutAction}><button className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">{t('خروج','Sign out')}</button></form>
        </div>
      </div>
    </header>

    <div className="app-shell-content mx-auto grid w-full max-w-[1600px] gap-5 px-3 py-4 sm:px-5 lg:grid-cols-[270px_minmax(0,1fr)] lg:px-8 lg:py-6">
      <aside className="app-shell-nav no-print min-w-0 lg:sticky lg:top-24 lg:self-start">
        <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:max-h-[calc(100vh-7rem)] lg:flex-col lg:overflow-y-auto" aria-label={t('التنقل الرئيسي','Main navigation')}>
          <NavItem href="/dashboard" icon="dashboard" label={t('لوحة القيادة','Dashboard')}/>
          {can('activity.create')?<NavItem href="/admin" icon="admin" label={t('إدارة الأنشطة','Activity Administration')}/>:null}
          {can('activity.view.assigned')?<NavItem href="/activities" icon="activities" label={t('أنشطتي','My Activities')}/>:null}
          {can('committee.manage_structure')?<NavItem href="/admin/committee" icon="committee" label={t('تشكيل اللجنة المؤسسية','Institutional Committee')}/>:null}
          {can('committee.prepare')?<NavItem href="/committee/secretary" icon="committee" label={t('مساحة سكرتير اللجنة','Committee Secretary')}/>:null}
          {can('activity.final_decision')?<NavItem href="/committee/chair" icon="committee" label={t('قرارات رئيس اللجنة','Chair Decisions')}/>:null}
          {context.activeRole==='COMMITTEE_MEMBER'?<NavItem href="/committee/member" icon="committee" label={t('مراجعات اللجنة','Committee Reviews')}/>:null}
          {can('external.view')?<NavItem href="/external" icon="external" label={t('التتبع الخارجي','External Tracking')}/>:null}
          {can('impact.view')?<NavItem href="/impact" icon="impact" label={t('قياس الأثر وHTVI','Impact & HTVI')}/>:null}
          {can('annual.view')?<NavItem href="/annual-reports" icon="annual" label={t('التقرير السنوي','Annual Report')}/>:null}
          {can('report.view')?<NavItem href="/reports" icon="reports" label={t('التقارير والطباعة','Reports & Printing')}/>:null}
          {can('evidence.readiness.view')?<NavItem href="/evidence" icon="evidence" label={t('جاهزية الأدلة','Evidence Readiness')}/>:null}
          {can('notification.view')?<NavItem href="/notifications" icon="notifications" label={t('الإشعارات','Notifications')}/>:null}
          {can('template.manage')||can('template.approve')?<NavItem href="/admin/templates" icon="templates" label={t('القوالب والإصدارات','Templates & Versions')}/>:null}
        </nav>
        <div className="mt-3 hidden rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500 shadow-sm lg:block"><div>{t('السياق النشط','Active context')}</div><strong className="text-slate-800">{roleLabel}</strong><div className="mt-2 border-t border-slate-100 pt-2 text-[10px] leading-5">{t('الموافقة الداخلية تعني جاهزية الرفع فقط ولا تمثل اعتمادًا خارجيًا.','Internal approval means submission readiness only; it is not external accreditation.')}</div></div>
      </aside>
      <main className="app-shell-main min-w-0">{children}</main>
    </div>
  </div>;
}
