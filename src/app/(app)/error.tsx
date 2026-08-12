'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ProtectedAreaError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  useEffect(()=>{console.error(error)},[error]);
  return <section className="grid min-h-[55vh] place-items-center"><div className="w-full max-w-2xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-50 text-2xl font-black text-amber-800">!</span><h1 className="mt-5 text-2xl font-black text-slate-950">تعذر فتح هذا القسم</h1><p className="mt-3 text-sm leading-7 text-slate-600">قد لا يمنح الدور النشط صلاحية لهذا المسار، أو قد تكون البيانات المطلوبة غير متاحة ضمن المؤسسة الحالية. ارجع إلى لوحة دورك لاختيار إجراء مصرح، أو أعد المحاولة إذا كان الخلل مؤقتًا.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/dashboard" className="rounded-xl bg-teal-900 px-5 py-3 text-sm font-black text-white">العودة إلى لوحة دوري</Link><button onClick={reset} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">إعادة المحاولة</button></div>{error.digest?<p className="mt-5 font-mono text-[10px] text-slate-400" dir="ltr">Reference: {error.digest}</p>:null}</div></section>;
}
