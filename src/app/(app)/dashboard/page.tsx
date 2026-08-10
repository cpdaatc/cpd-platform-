import Link from 'next/link';
import { NavIcon, type NavIconName } from '@/components/nav-icon';
import { ROLE_LABELS_AR, ROLE_LABELS_EN } from '@/lib/auth/labels';
import { roleHasPermission, type Permission } from '@/lib/auth/permissions';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUiLocale } from '@/lib/ui/locale';

type ActionCard={href:string;icon:NavIconName;ar:string;en:string;descAr:string;descEn:string;permission?:Permission;role?:string};

export default async function DashboardPage(){
  const context=await requireServerAuthContext(); const locale=await getUiLocale(); const ar=locale==='ar'; const t=(a:string,e:string)=>ar?a:e; const can=(p:Permission)=>roleHasPermission(context.activeRole,p); const s=await createServerSupabaseClient();
  const {data:activities}=await s.from('activities').select('id,internal_state').eq('organization_id',context.organizationId);
  const visibleActivities=activities??[]; const returned=visibleActivities.filter(a=>a.internal_state==='RETURNED_FOR_CORRECTION').length;
  let awaitingChair=0,impactDue=0,impactOverdue=0,unread=0,finalReports=0,annualPending=0;
  if(can('activity.final_decision')||can('committee.prepare')||context.activeRole==='COMMITTEE_MEMBER'){
    const {data}=await s.from('committee_reviews').select('id,status').eq('organization_id',context.organizationId); awaitingChair=(data??[]).filter(x=>x.status==='RECORDED').length;
  }
  if(can('impact.view')){
    const {data}=await s.from('activity_impact_schedules').select('status,due_at,grace_until').eq('organization_id',context.organizationId); const now=Date.now();
    for(const row of data??[]){if(['COMPLETED','NOT_APPLICABLE'].includes(String(row.status)))continue;const due=Date.parse(String(row.due_at)),grace=Date.parse(String(row.grace_until));if(now>grace)impactOverdue+=1;else if(now>=due)impactDue+=1;}
    const {data:reports}=await s.from('impact_reports').select('id,kind,status').eq('organization_id',context.organizationId).eq('kind','FINAL').eq('status','FINAL'); finalReports=reports?.length??0;
  }
  if(can('notification.view')){const {data}=await s.from('notifications').select('id,is_read').eq('organization_id',context.organizationId).eq('recipient_user_id',context.userId).eq('is_read',false);unread=data?.length??0;}
  if(can('annual.view')){const {data}=await s.from('annual_committee_reports').select('id,status').eq('organization_id',context.organizationId);annualPending=(data??[]).filter(r=>!['ACKNOWLEDGED','ARCHIVED'].includes(String(r.status))).length;}

  const actions:ActionCard[]=[
    {href:'/admin',icon:'admin',ar:'إدارة الأنشطة',en:'Activity Administration',descAr:'إنشاء الأنشطة والإسناد ومراقبة التشغيل.',descEn:'Create activities, assign officers and monitor operations.',permission:'activity.create'},
    {href:'/activities',icon:'activities',ar:'أنشطتي',en:'My Activities',descAr:'التعبئة الرقمية، PDF، المتحدثون والأدلة.',descEn:'Digital/PDF intake, speakers and evidence.',permission:'activity.view.assigned'},
    {href:'/admin/committee',icon:'committee',ar:'تشكيل اللجنة المؤسسية',en:'Institutional Committee Setup',descAr:'تسجيل قرار التشكيل وفترات العضوية.',descEn:'Record appointment decision and member terms.',permission:'committee.manage_structure'},
    {href:'/committee/secretary',icon:'committee',ar:'مساحة سكرتير اللجنة',en:'Committee Secretary Workspace',descAr:'الاجتماعات والحضور والمراجعة الجماعية والمحاضر.',descEn:'Meetings, attendance, collective review and minutes.',permission:'committee.prepare'},
    {href:'/committee/chair',icon:'committee',ar:'قرارات رئيس اللجنة',en:'Chair Decision Queue',descAr:'القرار النهائي الداخلي للرفع أو الإعادة أو عدم الموافقة.',descEn:'Final internal decision: approve for submission, return or not approve.',permission:'activity.final_decision'},
    {href:'/committee/member',icon:'committee',ar:'مراجعات اللجنة',en:'Committee Reviews',descAr:'الاطلاع وإضافة الملاحظات العلمية.',descEn:'Review activities and add scientific comments.',role:'COMMITTEE_MEMBER'},
    {href:'/external',icon:'external',ar:'التتبع الخارجي',en:'External Tracking',descAr:'تسجيل حالة الطلب الخارجي ودليل القرار.',descEn:'Record external submission status and decision evidence.',permission:'external.view'},
    {href:'/impact',icon:'impact',ar:'قياس الأثر وHTVI',en:'Impact & HTVI',descAr:'L1–L4، الاستحقاقات والتقرير النهائي.',descEn:'L1–L4, follow-up due dates and final report.',permission:'impact.view'},
    {href:'/annual-reports',icon:'annual',ar:'التقرير السنوي',en:'Annual Committee Report',descAr:'مؤشرات اللجنة والمساهمة واعتماد الرئيس وإقرار الإدارة.',descEn:'Committee metrics, contributions, Chair approval and management acknowledgement.',permission:'annual.view'},
    {href:'/evidence',icon:'evidence',ar:'جاهزية الأدلة',en:'Evidence Readiness',descAr:'اكتمال الأدلة والفجوات دون تحويلها لدرجة امتثال.',descEn:'Evidence completeness and gaps without a compliance score.',permission:'evidence.readiness.view'},
    {href:'/notifications',icon:'notifications',ar:'الإشعارات',en:'Notifications',descAr:'المواعيد المستحقة والمتأخرة والتنبيهات الحوكمية.',descEn:'Due, overdue and governance alerts.',permission:'notification.view'},
    {href:'/admin/templates',icon:'templates',ar:'القوالب والإصدارات',en:'Templates & Versions',descAr:'القوالب الرسمية والداخلية وMapping وQA والتفعيل.',descEn:'Official/internal templates, mapping, QA and activation.',role:'TEMPLATE'},
  ];
  const visibleActions=actions.filter(x=>x.permission?can(x.permission):x.role==='COMMITTEE_MEMBER'?context.activeRole==='COMMITTEE_MEMBER':x.role==='TEMPLATE'?(can('template.manage')||can('template.approve')):true);
  const roleLabel=ar?ROLE_LABELS_AR[context.activeRole]:ROLE_LABELS_EN[context.activeRole];
  const kpis=[
    [t('الأنشطة المرئية','Visible activities'),visibleActivities.length,'activities'],[t('معادة للتصحيح','Returned for correction'),returned,'activities'],[t('بانتظار قرار الرئيس','Awaiting Chair decision'),awaitingChair,'committee'],[t('متابعة أثر مستحقة','Impact due'),impactDue,'impact'],[t('متابعة أثر متأخرة','Impact overdue'),impactOverdue,'impact'],[t('تقارير أثر نهائية','Final impact reports'),finalReports,'annual'],[t('إشعارات غير مقروءة','Unread notifications'),unread,'notifications'],[t('تقارير سنوية مفتوحة','Open annual reports'),annualPending,'annual'],
  ] as [string,number,NavIconName][];

  return <section className="space-y-6" dir={ar?'rtl':'ltr'}>
    <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[.18em] text-teal-700">{t('لوحة القيادة المؤسسية','Institutional Dashboard')}</p><h1 className="mt-2 text-3xl font-black text-slate-950">{roleLabel}</h1><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">{t('تعرض اللوحة البيانات والإجراءات المتاحة للدور النشط فقط. إذا كان الحساب يحمل أكثر من دور، يبقى كل إجراء مسجلًا تحت Role Context المستخدم وقت التنفيذ.','The dashboard shows data and actions available to the active role only. If an account has multiple roles, every action remains recorded under the role context used at execution time.')}</p></div><div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-xs leading-6 text-violet-950 lg:max-w-xs">{t('قرار اللجنة داخل المنصة = جاهزية للرفع. الاعتماد الخارجي يظل حالة مستقلة موثقة بدليل.','Committee decision inside the platform = readiness for submission. External accreditation remains a separate evidence-backed status.')}</div></div></header>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{kpis.map(([label,value,icon])=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-500">{label}</span><span className="text-teal-700"><NavIcon name={icon}/></span></div><strong className="mt-3 block text-3xl font-black text-slate-950">{value}</strong></div>)}</div>

    <section><div className="mb-3 flex items-center justify-between"><div><h2 className="text-xl font-black">{t('مسارات العمل','Workspaces')}</h2><p className="mt-1 text-xs text-slate-500">{t('تظهر فقط المسارات المصرح بها للدور الحالي.','Only workspaces authorized for the active role are shown.')}</p></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleActions.map(action=><Link key={action.href} href={action.href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md"><span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-teal-800 transition group-hover:bg-teal-800 group-hover:text-white"><NavIcon name={action.icon}/></span><h3 className="mt-4 text-base font-black">{ar?action.ar:action.en}</h3><p className="mt-2 text-xs leading-6 text-slate-600">{ar?action.descAr:action.descEn}</p></Link>)}</div></section>
  </section>;
}
