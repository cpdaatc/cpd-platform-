import { setUiLocaleAction } from '@/app/locale/actions';
import type { UiLocale } from '@/lib/ui/locale';

export function LanguageToggle({locale}:{locale:UiLocale}){
  const next=locale==='ar'?'en':'ar';
  return <form action={setUiLocaleAction}>
    <input type="hidden" name="locale" value={next}/>
    <button type="submit" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50" aria-label={locale==='ar'?'Switch to English':'التغيير إلى العربية'}>
      {locale==='ar'?'EN':'العربية'}
    </button>
  </form>;
}
