'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavIcon, type NavIconName } from '@/components/nav-icon';

export type RoleNavigationItem = {
  href: string;
  icon: NavIconName;
  label: string;
  hint: string;
  exact?: boolean;
};

export type RoleNavigationGroup = {
  label: string;
  items: RoleNavigationItem[];
};

export function RoleNavigation({groups,ariaLabel}:{groups:RoleNavigationGroup[];ariaLabel:string}){
  const pathname=usePathname();
  return <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:max-h-[calc(100vh-7rem)] lg:flex-col lg:gap-3 lg:overflow-y-auto" aria-label={ariaLabel}>
    {groups.filter(group=>group.items.length>0).map(group=><section key={group.label} className="flex shrink-0 gap-1 lg:flex-col" aria-label={group.label}>
      <h2 className="hidden px-3 pt-1 text-[10px] font-black uppercase tracking-[.14em] text-slate-400 lg:block">{group.label}</h2>
      {group.items.map(item=>{
        const active=item.exact?pathname===item.href:pathname===item.href||pathname.startsWith(`${item.href}/`);
        return <Link key={item.href} href={item.href} aria-current={active?'page':undefined} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition lg:w-full ${active?'bg-teal-900 text-white shadow-sm':'text-slate-700 hover:bg-teal-50 hover:text-teal-950'}`}>
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active?'bg-white/15 text-white':'bg-slate-100 text-teal-800'}`}><NavIcon name={item.icon}/></span>
          <span className="min-w-0"><span className="block">{item.label}</span><span className={`mt-0.5 hidden truncate text-[9px] font-medium lg:block ${active?'text-teal-100':'text-slate-400'}`}>{item.hint}</span></span>
        </Link>;
      })}
    </section>)}
  </nav>;
}
