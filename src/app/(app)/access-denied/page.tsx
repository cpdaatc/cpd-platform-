import Link from 'next/link';

export default function AccessDeniedPage(){
  return <section className="grid min-h-[55vh] place-items-center"><div className="w-full max-w-2xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-50 text-2xl font-black text-amber-800">!</span><p className="mt-5 text-xs font-black uppercase tracking-[.16em] text-amber-700">Role Context Boundary</p><h1 className="mt-2 text-2xl font-black text-slate-950">هذا القسم غير متاح للدور الحالي</h1><p className="mt-3 text-sm leading-7 text-slate-600">لم تُنفذ العملية ولم تتغير أي بيانات. ارجع إلى لوحة دورك لاختيار مساحة عمل مصرح بها، أو بدّل الدور من أعلى الصفحة إذا كان حسابك يحمل مسؤولية أخرى.</p><Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-teal-900 px-5 py-3 text-sm font-black text-white">العودة إلى لوحة دوري</Link></div></section>;
}
