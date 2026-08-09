import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden bg-teal-950 px-14 py-16 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="inline-flex h-14 min-w-20 items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 text-lg font-black tracking-wider">
            CPD
          </div>
          <p className="mt-8 max-w-xl text-sm font-semibold text-teal-100">منصة مستقلة للحوكمة والتتبع المؤسسي</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-black leading-[1.35]">
            حوكمة التطوير المهني المستمر، جاهزية الاعتماد وذكاء الأثر
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-teal-50/85">
            سجل واحد يربط إعداد النشاط، المراجعة المؤسسية، القرار الداخلي، التتبع الخارجي وقياس الأثر دون خلط موافقة اللجنة باعتماد الهيئة.
          </p>
        </div>
        <p className="max-w-xl border-r-2 border-teal-400 pr-4 text-sm leading-7 text-teal-100">
          الموافقة داخل المنصة تعني الجاهزية للرفع فقط. اعتماد النشاط والساعات قرار خارجي يصدر من الجهة المنظمة المختصة.
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="inline-flex h-12 items-center justify-center rounded-xl bg-teal-900 px-4 font-black tracking-wider text-white">CPD</div>
          </div>
          <p className="text-sm font-bold text-teal-800">منصة التطوير المهني المستمر</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">تسجيل الدخول</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            استخدم الحساب المؤسسي المخصص لك. الصلاحيات الفعلية تُحدد حسب المؤسسة والدور النشط.
          </p>
          <LoginForm />
          <p className="mt-8 text-xs leading-6 text-slate-500">
            لا تستخدم هذه البيئة لبيانات حقيقية قبل استكمال إعدادات المؤسسة والخصوصية والإنتاج.
          </p>
        </div>
      </section>
    </main>
  );
}
