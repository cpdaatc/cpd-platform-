'use client';

import { useActionState } from 'react';
import type { UiLocale } from '@/lib/ui/locale';
import { loginAction, type LoginState } from './actions';

const initialState: LoginState = { error: null };

export function LoginForm({locale}:{locale:UiLocale}) {
  const [state, action, pending] = useActionState(loginAction, initialState);
  const ar=locale==='ar';
  return <form action={action} className="mt-7 space-y-5" noValidate>
    <div className="space-y-2"><label htmlFor="email" className="block text-sm font-bold text-slate-700">{ar?'البريد الإلكتروني':'Email address'}</label><input id="email" name="email" type="email" autoComplete="email" required dir="ltr" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-left text-slate-950 shadow-sm outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10" placeholder="name@organization.sa"/></div>
    <div className="space-y-2"><label htmlFor="password" className="block text-sm font-bold text-slate-700">{ar?'كلمة المرور':'Password'}</label><input id="password" name="password" type="password" autoComplete="current-password" minLength={8} required dir="ltr" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-left text-slate-950 shadow-sm outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"/></div>
    {state.error?<p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>:null}
    <button type="submit" disabled={pending} className="w-full rounded-xl bg-teal-800 px-5 py-3.5 font-black text-white shadow-sm transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60">{pending?(ar?'جارٍ التحقق…':'Checking…'):(ar?'تسجيل الدخول':'Sign in')}</button>
  </form>;
}
