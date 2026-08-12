import Link from 'next/link';
import type { ReactNode } from 'react';
import { logoutAction } from '@/app/login/actions';
import { resetContextAction, selectRoleAction } from '@/app/context/actions';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageToggle } from '@/components/language-toggle';
import { RoleNavigation, type RoleNavigationGroup } from '@/components/role-navigation';
import { ROLE_LABELS_AR, ROLE_LABELS_EN } from '@/lib/auth/labels';
import { roleHasPermission } from '@/lib/auth/permissions';
import { ROLE_GUIDANCE } from '@/lib/auth/role-guidance';
import type { RequiredServerAuthContext } from '@/lib/auth/server-context';
import type { UiLocale } from '@/lib/ui/locale';

export function AppShell({context,locale,children}:{context:RequiredServerAuthContext;locale:UiLocale;children:ReactNode}){
  const ar=locale==='ar'; const t=(a:string,e:string)=>ar?a:e;
  const organization=context.organizations.find(item=>item.id===context.organizationId);
  const can=(permission:Parameters<typeof roleHasPermission>[1])=>roleHasPermission(context.activeRole,permission);
  const roleLabel=ar?ROLE_LABELS_AR[context.activeRole]:ROLE_LABELS_EN[context.activeRole];
  const guidance=ROLE_GUIDANCE[context.activeRole];
  const item=(href: string, icon: RoleNavigationGroup['items'][number]['icon'], labelAr:string,labelEn:string,hintAr:string,hintEn:string,exact=false)=>({href,icon,label:t(labelAr,labelEn),hint:t(hintAr,hintEn),exact});
  const navigationGroups:RoleNavigationGroup[]=[
    {label:t('البدء','Start'),items:[
      item('/dashboard','dashboard','لوحة دوري','My Role Dashboard','المهام والأولويات','Tasks and priorities',true),
      ...(can('platform.manage')?[item('/platform','platform','حوكمة المنصة','Platform Governance','النطاق وعزل المؤسسات','Scope and tenant isolation')]:[]),
    ]},
    {label:t('دورة النشاط','Activity lifecycle'),items:[
      ...(can('activity.create')?[item('/admin','admin','إدارة الأنشطة','Activity Administration','الإنشاء والإسناد والمتابعة','Create, assign and monitor',true)]:[]),
      ...(can('activity.view.assigned')?[item('/activities','activities','أنشطتي','My Activities','الملف والجاهزية والتقديم','File, readiness and submission')]:[]),
      ...(can('committee.prepare')?[item('/committee/secretary','committee','مساحة سكرتير اللجنة','Committee Secretary','الاجتماعات والتقييم الجماعي','Meetings and collective review')]:[]),
      ...(can('activity.final_decision')?[item('/committee/chair','committee','قرارات رئيس اللجنة','Chair Decisions','القرار الداخلي والمحاضر','Internal decision and minutes')]:[]),
      ...(context.activeRole==='COMMITTEE_MEMBER'?[item('/committee/member','committee','مراجعات عضو اللجنة','Member Reviews','الملاحظات العلمية','Scientific comments')]:[]),
    ]},
    {label:t('المتابعة والمخرجات','Monitoring & outputs'),items:[
      ...(can('external.view')?[item('/external','external','التتبع الخارجي','External Tracking','حالة الرفع ودليل القرار','Submission status and evidence')]:[]),
      ...(can('impact.view')?[item('/impact','impact','قياس الأثر وHTVI','Impact & HTVI','L1–L4 والتقرير النهائي','L1–L4 and final report')]:[]),
      ...(can('annual.view')?[item('/annual-reports','annual','التقرير السنوي','Annual Report','أداء اللجنة والإقرار الإداري','Committee performance and acknowledgement')]:[]),
      ...(can('report.view')?[item('/reports','reports','التقارير والطباعة','Reports & Printing','مخرجات نهائية قابلة للطباعة','Final printable outputs')]:[]),
      ...(can('evidence.readiness.view')?[item('/evidence','evidence','جاهزية الأدلة','Evidence Readiness','الاكتمال والفجوات','Completeness and gaps')]:[]),
      ...(can('notification.view')?[item('/notifications','notifications','الإشعارات','Notifications','المواعيد والتنبيهات','Due dates and alerts')]:[]),
      ...(can('audit.view')?[item('/audit','audit','سجل التدقيق','Audit Trail','أثر غير قابل للتعديل','Immutable event trail')]:[]),
    ]},
    {label:t('إدارة المؤسسة','Organization administration'),items:[
      ...(can('organization.users.manage')?[item('/admin/users','users','المستخدمون والأدوار','Users & Roles','العضويات وفصل الصلاحيات','Membership and role separation')]:[]),
      ...(can('committee.manage_structure')?[item('/admin/committee','committee','تشكيل اللجنة','Committee Setup','القرار والعضويات','Appointment and memberships')]:[]),
      ...(can('ai.manage_references')?[item('/admin/references','references','المراجع والقواعد','References & Rules','المصادر والإصدارات','Sources and versions')]:[]),
      ...(can('ai.settings.configure')||can('ai.settings.approve')?[item('/admin/ai-settings','ai','خصوصية AI الخارجي','External AI Privacy','تكوين منفصل عن الاعتماد','Configuration separated from approval')]:[]),
      ...(can('template.manage')||can('template.approve')?[item('/admin/templates','templates','القوالب والإصدارات','Templates & Versions','QA والتفعيل المحكوم','Governed QA and activation')]:[]),
    ]},
  ];

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
        <RoleNavigation groups={navigationGroups} ariaLabel={t('التنقل الرئيسي حسب الدور','Role-based main navigation')}/>
        <div className="mt-3 hidden rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500 shadow-sm lg:block"><div>{t('السياق النشط','Active context')}</div><strong className="text-slate-800">{roleLabel}</strong><p className="mt-1 text-[10px] leading-5">{ar?guidance.missionAr:guidance.missionEn}</p><Link href={guidance.startHref} className="mt-3 block rounded-xl bg-teal-50 px-3 py-2 text-center text-[11px] font-black text-teal-900">{t('البدء من هنا','Start here')} · {ar?guidance.startAr:guidance.startEn}</Link><div className="mt-3 border-t border-slate-100 pt-2 text-[10px] leading-5">{ar?guidance.boundaryAr:guidance.boundaryEn}</div></div>
      </aside>
      <main className="app-shell-main min-w-0">{children}</main>
    </div>
  </div>;
}
