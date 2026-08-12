import { ROLE_LABELS_AR } from '@/lib/auth/labels';
import { requireServerAuthContext } from '@/lib/auth/server-context';

export default async function PlatformGovernancePage(){
  const context=await requireServerAuthContext('platform.manage');
  const organization=context.organizations.find(item=>item.id===context.organizationId);
  return <section className="space-y-6">
    <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-black uppercase tracking-[.18em] text-teal-700">Platform Governance</p><h1 className="mt-2 text-3xl font-black">حوكمة نطاق المنصة</h1><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">هذه المساحة توضح حدود مسؤول المنصة العام. صلاحية <span className="font-mono" dir="ltr">platform.manage</span> لا تمنح وصولًا ضمنيًا لملفات الأنشطة أو قرارات اللجان أو بيانات الأثر داخل المؤسسات.</p></header>
    <div className="grid gap-4 md:grid-cols-3"><State title="السياق الحالي" value={organization?.name??'—'} detail="المؤسسة المرتبطة بالجلسة الحالية"/><State title="الدور النشط" value={ROLE_LABELS_AR[context.activeRole]} detail="صلاحية منصة واحدة دون صلاحيات أعمال مؤسسية"/><State title="نموذج العزل" value="Tenant isolated" detail="كل قراءة تشغيلية تحتاج عضوية وصلاحية مؤسسية مستقلة"/></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black">نطاق المسؤولية</h2><div className="mt-5 grid gap-3 md:grid-cols-2"><Boundary title="ضمن الصلاحية" items={['إدارة إعدادات المنصة العامة عند توفيرها كوظائف محكومة','مراجعة نطاق المؤسسات المرتبطة بالحساب','التحقق من استمرار عزل بيانات المؤسسات']}/><Boundary title="خارج الصلاحية" items={['إنشاء نشاط أو إسناده','قراءة ملفات مؤسسة بلا عضوية وصلاحية','اتخاذ قرار علمي أو اعتماد إداري نيابةً عن الأدوار المختصة']}/></div><p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">لا توجد في النسخة الحالية إعدادات منصة عامة قابلة للتغيير من هذه الشاشة. إظهار الحدود صراحةً مقصود حتى لا تتحول صلاحية المنصة إلى تجاوز لصلاحيات المؤسسة.</p></section>
  </section>;
}

function State({title,value,detail}:{title:string;value:string;detail:string}){return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-xs font-bold text-slate-500">{title}</span><strong className="mt-2 block text-lg text-slate-950">{value}</strong><p className="mt-2 text-[11px] leading-5 text-slate-500">{detail}</p></article>}
function Boundary({title,items}:{title:string;items:string[]}){return <div className="rounded-xl bg-slate-50 p-4"><h3 className="font-black">{title}</h3><ul className="mt-3 space-y-2">{items.map(item=><li key={item} className="flex gap-2 text-xs leading-6 text-slate-600"><span className="font-black text-teal-700">•</span><span>{item}</span></li>)}</ul></div>}
