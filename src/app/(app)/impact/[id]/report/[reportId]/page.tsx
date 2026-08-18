import Link from 'next/link';
import { PrintButton } from '@/components/print-button';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type Json=Record<string,unknown>;
const domainLabels:Record<string,string>={PATIENT_IMPACT:'أثر المرضى',PRACTITIONER_IMPACT:'أثر الممارسين الصحيين',QUALITY_SAFETY:'الجودة والسلامة',SERVICE_EFFICIENCY:'كفاءة الخدمة'};

export default async function ImpactReportPage({params}:{params:Promise<{id:string;reportId:string}>}){
  const {id,reportId}=await params; const context=await requireServerAuthContext('impact.view'); const supabase=await createServerSupabaseClient();
  const [activityQ,reportQ]=await Promise.all([
    supabase.from('activities').select('activity_code,title_ar,title_en,activity_type,planned_start_date,planned_end_date').eq('id',id).eq('organization_id',context.organizationId).single(),
    supabase.from('impact_reports').select('*').eq('id',reportId).eq('activity_id',id).eq('organization_id',context.organizationId).single(),
  ]);
  if(activityQ.error||reportQ.error)throw new Error('التقرير غير متاح.');
  const a=activityQ.data; const r=reportQ.data; const snap=(r.snapshot_json??{}) as Json; const scores=(snap.level_scores??{}) as Json; const domains=(snap.impact_domains??{}) as Json; const objectives=(snap.objectives??[]) as Json[];
  const isFinal=String(r.kind)==='FINAL';
  return <section className="impact-report-root space-y-4">
    <div className="no-print flex flex-wrap items-center justify-between gap-3"><div className="flex gap-3"><Link href={`/activities/${id}/dossier`} className="font-bold text-teal-800">← ملف النشاط</Link><Link href={`/impact/${id}`} className="font-bold text-slate-600">قياس الأثر</Link></div><PrintButton/></div>
    {!isFinal?<div className="no-print rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">INTERIM — غير نهائي. HTVI يبقى PENDING.</div>:null}

    <article className="report-page mx-auto bg-white p-8 shadow-sm print:shadow-none">
      <header className="flex items-start justify-between gap-5 border-b-4 border-teal-700 pb-5"><div><p className="text-xs font-bold text-teal-700">CPD Governance & Impact Intelligence Platform</p><h1 className="mt-2 text-3xl font-black">تقرير قياس الأثر التدريبي</h1><p className="mt-1 text-sm text-slate-500">Healthcare Training Value Index (HTVI) — Internal Methodology</p></div><div className="rounded-2xl border border-slate-200 px-4 py-3 text-center"><div className="text-[10px] text-slate-500">Activity ID</div><strong className="font-mono text-sm" dir="ltr">{String(a.activity_code)}</strong></div></header>
      <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 text-sm"><div><span className="text-slate-500">عنوان النشاط</span><strong className="block">{String(a.title_ar)}</strong></div><div><span className="text-slate-500">نوع النشاط</span><strong className="block">{String(a.activity_type??'—')}</strong></div><div><span className="text-slate-500">البداية</span><strong className="block">{String(a.planned_start_date??'—')}</strong></div><div><span className="text-slate-500">النهاية</span><strong className="block">{String(a.planned_end_date??'—')}</strong></div></div>
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-teal-200 bg-teal-50 p-5"><div><p className="text-xs font-bold text-teal-700">التقييم العام</p><p className="mt-1 text-xl font-black text-teal-950">{String(r.overall_rating??(isFinal?'—':'PENDING'))}</p></div><div className="text-left"><strong className="text-5xl font-black text-teal-800">{r.htvi_score==null?'—':Number(r.htvi_score).toFixed(1)}</strong><div className="text-xs text-teal-700">HTVI / 100</div></div></div>
      <h2 className="mt-7 border-r-4 border-teal-700 pr-3 text-lg font-black">نتائج L1–L4</h2><div className="mt-4 grid grid-cols-4 gap-3">{['L1','L2','L3','L4'].map(level=><div key={level} className="rounded-xl border border-slate-200 p-4 text-center"><strong>{level}</strong><div className="mt-2 text-2xl font-black">{scores[level]==null?'—':Number(scores[level]).toFixed(1)}</div></div>)}</div>
      <h2 className="mt-7 border-r-4 border-teal-700 pr-3 text-lg font-black">مجالات الأثر</h2><table className="mt-4 w-full border-collapse text-sm"><thead><tr className="bg-slate-50"><th className="border border-slate-200 p-3 text-right">المجال</th><th className="border border-slate-200 p-3">النتيجة</th></tr></thead><tbody>{Object.entries(domains).map(([key,value])=><tr key={key}><td className="border border-slate-200 p-3">{domainLabels[key]??key}</td><td className="border border-slate-200 p-3 text-center font-bold">{Number(value).toFixed(1)}</td></tr>)}</tbody></table>
      <footer className="mt-10 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-500">هذا المؤشر منهجية داخلية لقياس الأثر ولا يمثل اعتمادًا أو مؤشرًا صادرًا عن الهيئة.</footer>
    </article>

    <article className="report-page report-page-break mx-auto bg-white p-8 shadow-sm print:shadow-none">
      <header className="border-b-4 border-teal-700 pb-5"><p className="text-xs font-bold text-teal-700">{String(a.activity_code)}</p><h2 className="mt-2 text-3xl font-black">الملخص التنفيذي للأثر</h2></header>
      <section className="mt-7"><h3 className="border-r-4 border-teal-700 pr-3 text-lg font-black">الاستنتاج التنفيذي</h3><p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm leading-8">{isFinal?`حقق النشاط HTVI قدره ${Number(r.htvi_score).toFixed(1)} من 100. يعكس هذا المؤشر النتائج النهائية للمستويات الأربعة وفق نسخة المنهجية المحفوظة مع التقرير، ويجب تفسيره مع نتائج المجالات والمؤشرات الأصلية.`:'هذا ملخص مرحلي. لم تكتمل جميع مستويات المتابعة المطلوبة ولذلك لا يوجد HTVI نهائي.'}</p></section>
      <section className="mt-7"><h3 className="border-r-4 border-teal-700 pr-3 text-lg font-black">ملخص الأهداف والمؤشرات</h3><table className="mt-4 w-full border-collapse text-xs"><thead><tr className="bg-slate-50"><th className="border border-slate-200 p-2 text-right">الهدف</th><th className="border border-slate-200 p-2">المجال</th><th className="border border-slate-200 p-2">التحقيق</th></tr></thead><tbody>{objectives.slice(0,6).map((o,index)=><tr key={index}><td className="border border-slate-200 p-2">{String(o.objective_text??'—')}</td><td className="border border-slate-200 p-2">{domainLabels[String(o.impact_domain)]??String(o.impact_domain??'—')}</td><td className="border border-slate-200 p-2 text-center">{o.achievement==null?'—':`${Number(o.achievement).toFixed(1)}%`}</td></tr>)}</tbody></table>{objectives.length>6?<p className="mt-3 text-xs text-slate-500">التفاصيل الإضافية موجودة في Detailed Impact Annex ولا تُضغط داخل التقرير الرسمي ذي الصفحتين.</p>:null}</section>
      <div className="mt-16 grid grid-cols-2 gap-16"><div className="border-t border-slate-400 pt-3 text-center text-sm">مسؤول النشاط<br/>الاسم والتوقيع</div><div className="border-t border-slate-400 pt-3 text-center text-sm">المراجع المخول<br/>الاسم والتوقيع</div></div>
      <footer className="mt-16 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-500">Final reports are immutable snapshots. Corrections require a controlled new version.</footer>
    </article>
  </section>;
}
