import { BrandLogo } from '@/components/brand-logo';
import { LanguageToggle } from '@/components/language-toggle';
import { getUiLocale } from '@/lib/ui/locale';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const locale=await getUiLocale(); const ar=locale==='ar'; const t=(a:string,e:string)=>ar?a:e;
  return <main className="min-h-screen bg-[#f4f8f7]" dir={ar?'rtl':'ltr'}>
    <div className="mx-auto grid min-h-screen w-full max-w-[1500px] lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative flex flex-col justify-center overflow-hidden px-6 py-9 sm:px-10 lg:px-16 lg:py-16">
        <div className="absolute -start-24 -top-24 h-72 w-72 rounded-full bg-teal-100/60 blur-3xl"/><div className="absolute -bottom-24 end-0 h-64 w-64 rounded-full bg-violet-100/70 blur-3xl"/>
        <div className="relative z-10 max-w-2xl">
          <BrandLogo className="h-24 w-28 rounded-2xl bg-white p-1 shadow-sm sm:h-32 sm:w-36"/>
          <p className="mt-5 text-xs font-black uppercase tracking-[.16em] text-teal-700">{t('حوكمة · جاهزية · ذكاء الأثر','Governance · Readiness · Impact Intelligence')}</p>
          <h1 className="mt-3 text-3xl font-black leading-[1.35] text-[#123f40] sm:text-4xl lg:text-5xl">{t('منصة التطوير المهني المستمر','Continuing Professional Development Platform')}</h1>
          <p className="mt-5 text-sm leading-8 text-slate-600 sm:text-base">{t('رحلة مؤسسية واحدة تربط إعداد النشاط، مراجعة الجاهزية، اللجنة العلمية المؤسسية، التتبع الخارجي، قياس الأثر والتقارير مع فصل كامل بين الموافقة الداخلية والاعتماد الخارجي.','One institutional journey connecting activity preparation, readiness review, institutional scientific governance, external tracking, impact measurement and reporting while keeping internal approval separate from external accreditation.')}</p>
          <div className="mt-6 rounded-2xl border border-violet-200 bg-white/90 p-4 text-xs leading-7 text-violet-950 shadow-sm">{t('الموافقة داخل المنصة تعني جاهزية النشاط للرفع فقط. اعتماد النشاط والساعات قرار خارجي مستقل صادر عن الجهة المنظمة المختصة.','Approval inside the platform means readiness for submission only. Activity and credit accreditation remain an independent external decision by the competent authority.')}</div>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 pb-10 pt-2 sm:px-8 lg:px-10 lg:py-12">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(7,79,75,.10)] sm:p-8">
          <div className="flex items-center justify-between gap-4"><BrandLogo className="h-16 w-20 rounded-xl bg-white"/><LanguageToggle locale={locale}/></div>
          <p className="mt-7 text-xs font-black uppercase tracking-[.14em] text-teal-700">{t('دخول مؤسسي آمن','Secure institutional access')}</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{t('تسجيل الدخول','Sign in')}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{t('استخدم حسابك المؤسسي. بعد الدخول يحدد النظام المؤسسة والدور النشط، ولا يدمج صلاحيات الأدوار المتعددة تلقائيًا.','Use your institutional account. After sign-in, the platform resolves the organization and active role context; multiple roles are not silently combined.')}</p>
          <LoginForm locale={locale}/>
          <div className="mt-7 border-t border-slate-100 pt-5 text-[11px] leading-6 text-slate-500">{t('لا تُدخل بيانات حقيقية في بيئة غير معتمدة للإنتاج أو قبل استكمال إعدادات المؤسسة والخصوصية.','Do not enter real data in a non-production environment or before organization and privacy controls are approved.')}</div>
        </div>
      </section>
    </div>
  </main>;
}
