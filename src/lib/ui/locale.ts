import { cookies } from 'next/headers';

export const UI_LOCALE_COOKIE='cpd_ui_locale';
export type UiLocale='ar'|'en';

export async function getUiLocale():Promise<UiLocale>{
  const store=await cookies();
  return store.get(UI_LOCALE_COOKIE)?.value==='en'?'en':'ar';
}

export function uiText(locale:UiLocale,ar:string,en:string):string{
  return locale==='ar'?ar:en;
}
