import { roleHasPermission } from '@/lib/auth/permissions';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { recordExternalStatusAction } from './actions';

const states = [
  'APPROVED_FOR_SCFHS_SUBMISSION','READY_FOR_SCFHS_SUBMISSION','EXTERNAL_TRACKING','ACTIVITY_CONDUCTED','IMPACT_FOLLOWUP','FINAL_IMPACT_REPORT','ANNUAL_REPORTING','ARCHIVED',
];

export default async function ExternalTrackingPage() {
  const context = await requireServerAuthContext('external.view');
  const canManage = roleHasPermission(context.activeRole, 'external.manage');
  const supabase = await createServerSupabaseClient();
  const { data: activities, error } = await supabase.from('activities')
    .select('id,activity_code,title_ar,title_en,internal_state')
    .eq('organization_id', context.organizationId).in('internal_state', states).order('updated_at',{ascending:false});
  if (error) throw new Error('تعذر تحميل الأنشطة الجاهزة للتتبع الخارجي.');
  const activityIds=(activities ?? []).map((a)=>a.id);
  const { data: records }=activityIds.length ? await supabase.from('external_submission_records').select('*').eq('organization_id',context.organizationId).in('activity_id',activityIds) : {data:[]};
  const byActivity=new Map((records ?? []).map((r)=>[String(r.activity_id),r]));

  return <section className="space-y-6">
    <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-black uppercase tracking-[.18em] text-teal-700">External Accreditation Tracking</p>
      <h1 className="mt-2 text-3xl font-black text-slate-950">تتبع حالة الرفع الخارجي</h1>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">تسجيل يدوي للحالة الفعلية بعد موافقة رئيس اللجنة على جاهزية الرفع. هذه الشاشة لا تنشئ اعتمادًا ولا تفترض وجود تكامل API مع الهيئة.</p>
      <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-xs leading-6 text-violet-900">الموافقة الداخلية والاعتماد الخارجي حالتان منفصلتان. لا تظهر حالة APPROVED خارجيًا إلا مع تاريخ القرار ومرجع دليل خارجي.</div>
    </header>

    <div className="grid gap-4">
      {(activities ?? []).length===0 ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">لا توجد أنشطة معتمدة داخليًا وجاهزة للتتبع الخارجي.</div> : (activities ?? []).map((activity)=>{
        const record=byActivity.get(String(activity.id));
        return <article key={String(activity.id)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><div className="font-mono text-xs font-bold text-slate-500" dir="ltr">{String(activity.activity_code)}</div><h2 className="mt-1 text-xl font-black">{String(activity.title_ar)}</h2>{activity.title_en?<p className="text-xs text-slate-500" dir="ltr">{String(activity.title_en)}</p>:null}</div>
            <div className="text-left"><span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-black text-teal-900">{record?String(record.status):'NOT_SUBMITTED'}</span><div className="mt-2 text-xs text-slate-500">Internal: {String(activity.internal_state)}</div></div>
          </div>
          {record ? <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-xs sm:grid-cols-3"><div><span className="text-slate-500">رقم الطلب</span><strong className="mt-1 block">{String(record.request_number ?? '—')}</strong></div><div><span className="text-slate-500">رقم الاعتماد</span><strong className="mt-1 block">{String(record.accreditation_number ?? '—')}</strong></div><div><span className="text-slate-500">مرجع الدليل</span><strong className="mt-1 block break-all">{String(record.evidence_reference ?? '—')}</strong></div></div>:null}
          {canManage ? <details className="mt-4 rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-black text-teal-900">تحديث الحالة الخارجية</summary><form action={recordExternalStatusAction} className="mt-4 grid gap-3 md:grid-cols-2">
            <input type="hidden" name="activityId" value={String(activity.id)}/>
            <label className="text-xs font-bold">الحالة<select name="status" defaultValue={record?String(record.status):'READY_FOR_SCFHS_SUBMISSION'} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option>READY_FOR_SCFHS_SUBMISSION</option><option>SUBMITTED</option><option>UNDER_REVIEW</option><option>RETURNED</option><option>APPROVED</option><option>REJECTED</option></select></label>
            <label className="text-xs font-bold">رقم الطلب<input name="requestNumber" defaultValue={String(record?.request_number ?? '')} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" dir="ltr"/></label>
            <label className="text-xs font-bold">تاريخ الرفع<input type="date" name="submissionDate" defaultValue={String(record?.submission_date ?? '')} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5"/></label>
            <label className="text-xs font-bold">نوع الخدمة<input name="serviceType" defaultValue={String(record?.service_type ?? 'CPD_ACTIVITY')} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5"/></label>
            <label className="text-xs font-bold">رقم الاعتماد الخارجي<input name="accreditationNumber" defaultValue={String(record?.accreditation_number ?? '')} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" dir="ltr"/></label>
            <label className="text-xs font-bold">الساعات المعتمدة<input type="number" step="0.25" min="0" name="approvedHours" defaultValue={record?.approved_hours==null?'':String(record.approved_hours)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5"/></label>
            <label className="text-xs font-bold">تاريخ القرار<input type="date" name="decisionDate" defaultValue={String(record?.decision_date ?? '')} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5"/></label>
            <label className="text-xs font-bold">مرجع دليل القرار<input name="evidenceReference" defaultValue={String(record?.evidence_reference ?? '')} placeholder="storage/path or verified reference" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" dir="ltr"/></label>
            <label className="text-xs font-bold md:col-span-2">ملاحظات الإعادة<input name="returnNotes" defaultValue={String(record?.return_notes ?? '')} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5"/></label>
            <button className="justify-self-end rounded-xl bg-teal-800 px-5 py-3 text-sm font-black text-white md:col-span-2">حفظ الحالة الخارجية</button>
          </form></details>:null}
        </article>;
      })}
    </div>
  </section>;
}
