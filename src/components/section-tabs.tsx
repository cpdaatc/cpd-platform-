'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SectionTabs({links,ariaLabel}:{links:{href:string;label:string;exact?:boolean}[];ariaLabel:string}){
  const pathname=usePathname();
  return <nav className="no-print flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label={ariaLabel}>
    {links.map(link=>{
      const active=link.exact?pathname===link.href:pathname===link.href||pathname.startsWith(`${link.href}/`);
      return <Link key={link.href} href={link.href} aria-current={active?'page':undefined} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${active?'bg-teal-900 text-white':'text-slate-700 hover:bg-teal-50 hover:text-teal-900'}`}>{link.label}</Link>;
    })}
  </nav>;
}
