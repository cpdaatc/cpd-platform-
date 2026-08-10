import Link from 'next/link';
import { NavIcon } from '@/components/nav-icon';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function ReportsPage(){
  const c=await requireServerAuthContext('report.view'); const s=await createServerSupabaseClient();
  const [impactQ,annualQ,minutesQ,activitiesQ]=await Promise.all([
    s.from('impact_reports').select('id,activity_id,version_no,htvi_score,overall_rating,generated_at').eq('organization_id',c.organizationId).eq('kind','FINAL').eq('status','FINAL').order('generated_at',{ascending:false}).limit(30),
    s.from('annual_committee_reports').select('id,reporting_year,status,generated_at').eq('organization_id',c.organizationId).order('reporting_year',{ascending:false}).limit(10),
    s.from('committee_minutes').select('id,activity_id,version_no,status,finalized_at,snapshot_json').eq('organization_id',c.organizationId).eq('status','FINAL').order('finalized_at',{ascending:false}).limit(30),
    s.from('activities').select('id,activity_code,title_ar').eq('organization_id',c.organizationId),
  ]);
  if(impactQ.error||annualQ.error||minutesQ.error||activitiesQ.error)throw new Error('تعذر تحميل مركز التقارير.');
  const activities=new Map((activitiesQ.data??[]).map(a=>[String(a.id),a]));
  return <section className="space-y-6"><header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-black uppercase tracking-[.18em] text-teal-700">Reports & Printing</p><h1 className="mt-2 text-3xl font-black">التقارير والطباعة</h1><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">المخرجات الرسمية/الداخلية تُولّد من السجلات التشغيلية نفسها. لا تستخدم هذه الشاشة بيانات Demo منفصلة.</p></header>
    <div className="grid gap-4 md:grid-cols-3"><Summary icon="impact" title="تقارير الأثر النهائية" value={impactQ.data?.length??0}/><Summary icon="annual" title="التقارير السنوية" value={annualQ.data?.length??0}/><Summary icon="committee" title="محاضر اللجنة النهائية" value={minutesQ.data?.length??0}/></div>
    <ReportSection title="تقارير قياس الأثر" empty="لا توجد تقارير أثر نهائية.">{(impactQ.data??[]).map(r=>{const a=activities.get(String(r.activity_id));return <Link key={String(r.id)} href={`/impact/${String(r.activity_id)}/report/${String(r.id)}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 text-sm hover:bg-teal-50"><div><strong>{String(a?.activity_code??'—')} · {String(a?.title_ar??'Activity')}</strong><p className="mt-1 text-xs text-slate-500">Final v{String(r.version_no)} · {String(r.overall_rating??'—')}</p></div><span className="rounded-xl bg-teal-800 px-3 py-2 text-xs font-black text-white">🖨 {r.htvi_score==null?'—':Number(r.htvi_score).toFixed(1)}</span></Link>})}</ReportSection>
    <ReportSection title="التقرير السنوي لأداء اللجنة" empty="لا توجد تقارير سنوية.">{(annualQ.data??[]).map(r=><Link key={String(r.id)} href={`/annual-reports/${String(r.id)}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-4 text-sm hover:bg-teal-50"><strong>{String(r.reporting_year)}</strong><span className="rounded-full bg-white px-3 py-1 text-xs font-bold">{String(r.status)}</span></Link>)}</ReportSection>
    <ReportSection title="محاضر اللجنة العلمية المؤسسية" empty="لا توجد محاضر نهائية.">{(minutesQ.data??[]).map(r=>{const a=activities.get(String(r.activity_id));return <Link key={String(r.id)} href={`/reports/minutes/${String(r.id)}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 text-sm hover:bg-teal-50"><div><strong>{String(a?.activity_code??'—')} · {String(a?.title_ar??'Activity')}</strong><p className="mt-1 text-xs text-slate-500">Minutes v{String(r.version_no)}</p></div><span className="font-bold text-teal-800">عرض / طباعة</span></Link>})}</ReportSection>
  </section>;
}
function Summary({icon,title,value}:{icon:'impact'|'annual'|'committee';title:string;value:number}){return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-teal-700"><NavIcon name={icon}/></span><span className="mt-3 block text-xs text-slate-500">{title}</span><strong className="mt-1 block text-3xl">{value}</strong></div>}
function ReportSection({title,empty,children}:{title:string;empty:string;children:React.ReactNode}){const items=Array.isArray(children)?children:[children];return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black">{title}</h2><div className="mt-4 grid gap-2">{items.length&&items[0]?children:<p className="text-sm text-slate-500">{empty}</p>}</div></section>}
