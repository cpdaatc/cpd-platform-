import Link from 'next/link';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function resolveValue(field:string,activity:Record<string,unknown>,profile:Record<string,unknown>|null){
  const values:Record<string,unknown>={
    activityCode:activity.activity_code,titleAr:activity.title_ar,titleEn:activity.title_en,activityType:activity.activity_type,deliveryMethod:activity.delivery_method,
    plannedStartDate:activity.planned_start_date,plannedEndDate:activity.planned_end_date,specialty:profile?.specialty,targetAudience:profile?.target_audience,learningGap:profile?.learning_gap,
    aimAndOutcomes:profile?.aim_and_outcomes,learningMethods:profile?.learning_methods,participantEvaluationMethod:profile?.participant_evaluation_method,scfhsRegistrationNumber:profile?.scfhs_registration_number,
  };
  return values[field]??null;
}

export default async function OfficialPreviewPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params; const c=await requireServerAuthContext('activity.fill_submit'); const s=await createServerSupabaseClient();
  const [activityQ,profileQ,templateQ]=await Promise.all([
    s.from('activities').select('*').eq('id',id).eq('organization_id',c.organizationId).single(),
    s.from('activity_intake_profiles').select('*').eq('activity_id',id).eq('organization_id',c.organizationId).maybeSingle(),
    s.from('document_templates').select('id,template_code,name_ar,name_en,template_family,template_versions(id,version_label,status,effective_from,effective_to,source_reference,storage_path,checksum,visual_qa_status,template_mapping_versions(id,mapping_version,field_mappings,regression_test_status))').eq('organization_id',c.organizationId).eq('template_family','OFFICIAL_EXTERNAL_FORM'),
  ]);
  if(activityQ.error||profileQ.error||templateQ.error)throw new Error('تعذر تحميل المعاينة الرسمية.');
  const templates=templateQ.data??[]; let template:Record<string,unknown>|null=null;let version:Record<string,unknown>|null=null;let mapping:Record<string,unknown>|null=null;
  for(const row of templates){const versions=(row.template_versions??[]) as Array<Record<string,unknown>>;const active=versions.find(v=>v.status==='ACTIVE');if(active){template=row;version=active;mapping=((active.template_mapping_versions??[]) as Array<Record<string,unknown>>)[0]??null;break;}}
  let signedUrl:string|null=null;if(version?.storage_path){const {data}=await s.storage.from('cpd-documents').createSignedUrl(String(version.storage_path),60*10);signedUrl=data?.signedUrl??null;}
  const mappings=Array.isArray(mapping?.field_mappings)?mapping.field_mappings as Array<Record<string,unknown>>:[];
  return <section className="space-y-6"><div className="flex gap-2 text-sm"><Link href={`/activities/${id}/intake`} className="font-bold text-teal-800">ملف النشاط</Link><span className="text-slate-400">/</span><span>Official Preview</span></div>
    <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-black uppercase tracking-[.18em] text-teal-700">Official Template Preview</p><h1 className="mt-2 text-3xl font-black">معاينة القالب الرسمي وربط الحقول</h1><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">تعرض هذه الشاشة النسخة الأصلية النشطة من القالب، الـchecksum وخريطة الحقول مقابل Structured Activity Record. لا يُعاد رسم القالب أو الشعار، ولا تُغيّر السجلات التاريخية إذا فُعّل إصدار أحدث.</p></header>
    {!version?<div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-7 text-amber-900"><strong>لا يوجد Official External Form نشط.</strong><p className="mt-2">يجب على مسؤول النظام رفع نسخة القالب، إجراء Visual/Mapping QA، ثم يعتمدها MANAGEMENT_APPROVER قبل استخدامها. إلى ذلك الحين تبقى التعبئة الرقمية هي سجل العمل ولا يتم اختراع معاينة رسمية.</p></div>:<>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="font-mono text-xs font-bold text-slate-500" dir="ltr">{String(template?.template_code)}</div><h2 className="mt-1 text-xl font-black">{String(template?.name_ar)}</h2><p className="mt-1 text-xs text-slate-500">Version {String(version.version_label)} · Mapping {String(mapping?.mapping_version??'—')}</p></div><div className="text-left text-xs"><div>Visual QA: <strong>{String(version.visual_qa_status)}</strong></div><div className="mt-1">Mapping QA: <strong>{String(mapping?.regression_test_status??'—')}</strong></div><div className="mt-1 font-mono" dir="ltr">SHA {String(version.checksum).slice(0,16)}…</div></div></div></section>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-4"><h2 className="font-black">Original Template</h2>{signedUrl?<a href={signedUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">فتح الملف الأصلي</a>:null}</div>{signedUrl&&String(version.storage_path).toLowerCase().endsWith('.pdf')?<iframe src={signedUrl} className="h-[720px] w-full" title="Official template PDF"/>:<div className="grid min-h-80 place-items-center p-8 text-center text-sm text-slate-500">المتصفح لا يعرض هذا النوع داخل الصفحة. استخدم «فتح الملف الأصلي».</div>}</section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black">Structured Field Mapping</h2><p className="mt-2 text-xs leading-6 text-slate-500">الإحداثيات تستخدم لاحقًا عند توليد نسخة مطبوعة من القالب. القيمة هنا تأتي من سجل النشاط الحالي.</p><div className="mt-4 space-y-2">{mappings.length===0?<p className="rounded-xl bg-amber-50 p-4 text-xs text-amber-900">لا توجد Field Mapping معتمدة لهذا الإصدار؛ لا يمكن توليد Filled Official Output بأمان حتى يكتمل Mapping QA.</p>:mappings.map((m,i)=>{const field=String(m.field??m.fieldKey??'');return <div key={i} className="rounded-xl bg-slate-50 p-3 text-xs"><div className="flex justify-between gap-2"><strong className="font-mono" dir="ltr">{field}</strong><span>Page {String(m.page??'—')}</span></div><div className="mt-2 break-words text-slate-700">{String(resolveValue(field,activityQ.data,profileQ.data)??'—')}</div><div className="mt-1 font-mono text-[9px] text-slate-400" dir="ltr">x={String(m.x??'—')} · y={String(m.y??'—')} · size={String(m.fontSize??'—')}</div></div>})}</div></section>
      </div>
    </>}
  </section>;
}
