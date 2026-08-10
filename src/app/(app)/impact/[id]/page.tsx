import Link from 'next/link';
import { ImpactLevelForms } from '@/features/impact/impact-level-forms';
import { L4ObjectivesForm } from '@/features/impact/l4-objectives-form';
import { roleHasPermission } from '@/lib/auth/permissions';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateImpactReportAction } from '../actions';

function currentStatus(row:Record<string,unknown>){
  const status=String(row.status); if(['COMPLETED','NOT_APPLICABLE'].includes(status))return status;
  const now=Date.now(); if(now<Date.parse(String(row.due_at)))return 'NOT_DUE'; if(now>Date.parse(String(row.grace_until)))return 'OVERDUE'; return 'DUE';
}

export default async function ImpactActivityPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params; const context=await requireServerAuthContext('impact.view');
  const canManage=roleHasPermission(context.activeRole,'impact.manage'); const canFinalize=roleHasPermission(context.activeRole,'impact.finalize');
  const supabase=await createServerSupabaseClient();
  const [activityQ,schedulesQ,levelsQ,objectivesQ,reportsQ]=await Promise.all([
    supabase.from('activities').select('id,activity_code,title_ar,title_en,internal_state').eq('id',id).eq('organization_id',context.organizationId).single(),
    supabase.from('activity_impact_schedules').select('*').eq('activity_id',id).eq('organization_id',context.organizationId).order('level'),
    supabase.from('impact_level_results').select('*').eq('activity_id',id).eq('organization_id',context.organizationId),
    supabase.from('impact_objectives').select('*').eq('activity_id',id).eq('organization_id',context.organizationId).order('id'),
    supabase.from('impact_reports').select('id,kind,version_no,status,htvi_status,htvi_score,overall_rating,generated_at').eq('activity_id',id).eq('organization_id',context.organizationId).order('generated_at',{ascending:false}),
  ]);
  if(activityQ.error||schedulesQ.error||levelsQ.error||objectivesQ.error||reportsQ.error)throw new Error('تعذر تحميل قياس الأثر.');
  const activity=activityQ.data; const schedules=(schedulesQ.data??[]).map(row=>({...row,displayStatus:currentStatus(row)}));
  const scores=new Map((levelsQ.data??[]).map(row=>[String(row.level),row.score])); const finalReport=(reportsQ.data??[]).find(r=>r.kind==='FINAL'&&r.status==='FINAL');
  const readyFinal=schedules.filter(s=>s.required).length>0&&schedules.filter(s=>s.required).every(s=>s.displayStatus==='COMPLETED');

  return <section className="space-y-6">
    <div className="flex gap-2 text-sm"><Link href="/impact" className="font-bold text-teal-800">قياس الأثر</Link><span className="text-slate-400">/</span><span>{String(activity.activity_code)}</span></div>
    <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="font-mono text-xs font-bold text-slate-500" dir="ltr">{String(activity.activity_code)}</div><h1 className="mt-2 text-3xl font-black">{String(activity.title_ar)}</h1><p className="mt-3 text-sm leading-7 text-slate-600">HTVI = PENDING إلى أن تكتمل كل المستويات المطلوبة؛ لا يُعاد توزيع الأوزان ولا تُحسب NOT_DUE كصفر.</p>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{schedules.map(s=><div key={String(s.id)} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between"><strong>{String(s.level)}</strong><span className={`rounded-full px-2 py-1 text-[10px] font-black ${s.displayStatus==='COMPLETED'?'bg-emerald-100 text-emerald-800':s.displayStatus==='OVERDUE'?'bg-red-100 text-red-800':'bg-amber-100 text-amber-800'}`}>{String(s.displayStatus)}</span></div><div className="mt-3 text-2xl font-black">{scores.get(String(s.level))==null?'—':Number(scores.get(String(s.level))).toFixed(1)}</div><div className="mt-1 text-[10px] text-slate-500">Due {new Date(String(s.due_at)).toLocaleDateString('ar-SA')}</div></div>)}</div>
    </header>

    {finalReport?<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold text-emerald-800">FINAL HTVI</p><div className="mt-1 text-4xl font-black">{Number(finalReport.htvi_score).toFixed(1)}</div><p className="text-sm">{String(finalReport.overall_rating)}</p></div><Link href={`/impact/${id}/report/${String(finalReport.id)}`} className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-black text-white">عرض / طباعة التقرير</Link></div></div>:null}

    {canManage&&!finalReport?<><ImpactLevelForms activityId={id}/><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black">L4 — النتائج والأثر</h2><p className="mt-2 text-sm leading-7 text-slate-600">أهداف ومؤشرات الأثر تحسب باتجاه زيادة/خفض وبأوزانها، مع معالجة صريحة للقيم الصفرية.</p><div className="mt-5"><L4ObjectivesForm activityId={id}/></div></section></>:null}

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-black">تقارير الأثر</h2><p className="mt-1 text-sm text-slate-600">Interim غير نهائي، Final Snapshot نهائي ومحمي من التعديل.</p></div>{canFinalize&&!finalReport?<div className="flex gap-2"><form action={generateImpactReportAction}><input type="hidden" name="activityId" value={id}/><input type="hidden" name="kind" value="INTERIM"/><button className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold">Interim</button></form><form action={generateImpactReportAction}><input type="hidden" name="activityId" value={id}/><input type="hidden" name="kind" value="FINAL"/><button disabled={!readyFinal} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Final</button></form></div>:null}</div>
      <div className="mt-4 space-y-2">{(reportsQ.data??[]).map(r=><div key={String(r.id)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 text-sm"><span><strong>{String(r.kind)} v{String(r.version_no)}</strong> · {String(r.htvi_status)} {r.htvi_score==null?'':`· ${Number(r.htvi_score).toFixed(1)}`}</span><Link href={`/impact/${id}/report/${String(r.id)}`} className="font-bold text-teal-800">معاينة</Link></div>)}</div>
    </section>
    {(objectivesQ.data??[]).length>6?<Link href={`/impact/${id}/annex`} className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold">Detailed Impact Annex</Link>:null}
  </section>;
}
