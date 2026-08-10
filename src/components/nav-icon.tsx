export type NavIconName='dashboard'|'activities'|'committee'|'external'|'impact'|'annual'|'reports'|'evidence'|'notifications'|'admin'|'templates'|'users'|'references';

export function NavIcon({name}:{name:NavIconName}){
  const common={width:20,height:20,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true};
  if(name==='dashboard')return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
  if(name==='activities')return <svg {...common}><path d="M7 3h10v4H7z"/><path d="M5 5H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1"/><path d="M7 12h10M7 16h7"/></svg>;
  if(name==='committee')return <svg {...common}><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c.7-4 2.6-6 5.5-6s4.8 2 5.5 6M14 15c1-.8 2-1.2 3.2-1.2 2.3 0 3.8 1.7 4.3 5"/></svg>;
  if(name==='external')return <svg {...common}><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M19 13v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h7"/></svg>;
  if(name==='impact')return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="m4 8 6-4 6 6 5-5"/></svg>;
  if(name==='annual')return <svg {...common}><path d="M4 4h16v16H4z"/><path d="M8 2v4M16 2v4M4 9h16"/><path d="M8 13h2M14 13h2M8 17h2"/></svg>;
  if(name==='reports')return <svg {...common}><path d="M7 8V3h10v5"/><path d="M6 17H4a2 2 0 0 1-2-2v-4a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7z"/><path d="M17 11h1"/></svg>;
  if(name==='evidence')return <svg {...common}><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="m9 14 2 2 4-5"/></svg>;
  if(name==='notifications')return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
  if(name==='templates')return <svg {...common}><path d="M5 3h14v18H5z"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>;
  if(name==='users')return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6"/><circle cx="18" cy="9" r="2"/><path d="M15.5 14.5c3.2-.8 5.2.8 5.5 4.5"/></svg>;
  if(name==='references')return <svg {...common}><path d="M4 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4z"/><path d="M20 4h-4a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h4z"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1z"/></svg>;
}
