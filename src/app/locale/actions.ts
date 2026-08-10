'use server';

import { cookies } from 'next/headers';
import { UI_LOCALE_COOKIE } from '@/lib/ui/locale';

export async function setUiLocaleAction(formData:FormData):Promise<void>{
  const locale=String(formData.get('locale')??'ar')==='en'?'en':'ar';
  const store=await cookies();
  store.set(UI_LOCALE_COOKIE,locale,{path:'/',sameSite:'lax',httpOnly:false,secure:process.env.NODE_ENV==='production',maxAge:60*60*24*365});
}
