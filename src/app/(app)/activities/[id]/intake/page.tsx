import Link from 'next/link';
import { IntakeWorkspaceForm } from '@/features/intake/intake-workspace-form';
import { getActivityIntakeWorkspace } from '@/features/intake/queries';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { applyConfirmedExtractionAction, confirmExtractionFieldAction } from './actions';

function labelForField(key: string): string {
  const labels: Record<string,string> = {
    titleEn: 'Activity Title in English', titleAr: 'Activity Title in Arabic', specialty: 'Specialty',
    targetAudience: 'Target Audience', learningGap: 'Learning Need / Gap', aimAndOutcomes: 'Aim & Outcomes',
    learningMethods: 'Learning Methods', participantEvaluationMethod: 'Participant Evaluation', scfhsRegistrationNumber: 'SCFHS Registration #',
  };
  return labels[key] ?? key;
}

export default async function ActivityIntakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireServerAuthContext('activity.fill_submit');
  const workspace = await getActivityIntakeWorkspace(id);
  const latestRunId = workspace.latestExtractionRun?.id ? String(workspace.latestExtractionRun.id) : null;

  return (
    <section className="space-y-7">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/activities" className="font-bold text-teal-800 hover:underline">أنشطتي</Link>
        <span className="text-slate-400">/</span><span className="text-slate-500">إعداد ملف النشاط</span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="font-mono text-xs font-bold text-slate-500" dir="ltr">{workspace.activity.activityCode}</div>
        <h1 className="mt-2 text-3xl font-black text-slate-950">{workspace.activity.titleAr}</h1>
        {workspace.activity.titleEn ? <p className="mt-1 text-sm text-slate-500" dir="ltr">{workspace.activity.titleEn}</p> : null}
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4"><span className="block text-xs text-slate-500">نوع النشاط</span><strong>{workspace.activity.activityType ?? 'غير مكتمل'}</strong></div>
          <div className="rounded-xl bg-slate-50 p-4"><span className="block text-xs text-slate-500">طريقة التنفيذ</span><strong>{workspace.activity.deliveryMethod ?? 'غير مكتمل'}</strong></div>
          <div className="rounded-xl bg-slate-50 p-4"><span className="block text-xs text-slate-500">التواريخ</span><strong>{workspace.activity.plannedStartDate ?? '—'} → {workspace.activity.plannedEndDate ?? '—'}</strong></div>
        </div>
      </div>

      {workspace.extractionFields.length > 0 && latestRunId ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-wide text-amber-800">PDF Verification</p><h2 className="mt-1 text-xl font-black text-slate-950">تحقق من البيانات المستخرجة قبل استخدامها</h2><p className="mt-2 text-sm leading-7 text-slate-700">UNCERTAIN لا تعني Missing أو Non-compliant. عدّل القيمة إن لزم ثم أكدها؛ النظام لا يكتبها في سجل النشاط تلقائيًا.</p></div>
            <form action={applyConfirmedExtractionAction}><input type="hidden" name="activityId" value={id}/><input type="hidden" name="runId" value={latestRunId}/><button className="rounded-xl bg-amber-800 px-4 py-3 text-sm font-bold text-white">تطبيق الحقول المؤكدة</button></form>
          </div>
          <div className="mt-5 grid gap-3">
            {workspace.extractionFields.map((field) => {
              const fieldId=String(field.id); const key=String(field.field_key); const status=String(field.status); const value=field.normalized_value==null?'':String(field.normalized_value); const confidence=field.confidence==null?null:Number(field.confidence);
              return <form action={confirmExtractionFieldAction} key={fieldId} className="grid gap-3 rounded-xl border border-amber-100 bg-white p-4 md:grid-cols-[220px_1fr_120px_auto] md:items-end">
                <input type="hidden" name="activityId" value={id}/><input type="hidden" name="fieldId" value={fieldId}/>
                <div><div className="text-xs text-slate-500">الحقل</div><div className="mt-1 text-sm font-bold">{labelForField(key)}</div><div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status==='UNCERTAIN'?'bg-amber-100 text-amber-900':'bg-teal-50 text-teal-900'}`}>{status}</div></div>
                <label className="text-xs font-bold text-slate-600">القيمة المستخرجة<input name="value" defaultValue={value} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label>
                <div><div className="text-xs text-slate-500">Confidence</div><div className="mt-2 font-mono text-sm font-bold" dir="ltr">{confidence==null?'—':`${Math.round(confidence*100)}%`}</div></div>
                <div className="flex gap-2"><button name="corrected" value="0" className="rounded-lg bg-teal-800 px-3 py-2 text-xs font-bold text-white">تأكيد</button><button name="corrected" value="1" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">تعديل وتأكيد</button></div>
              </form>;
            })}
          </div>
        </section>
      ) : null}

      <IntakeWorkspaceForm
        activity={workspace.activity}
        profile={workspace.profile}
        needsAssessmentTools={workspace.needsAssessmentTools}
        objectives={workspace.objectives}
        committeeMembers={workspace.committeeMembers}
        speakers={workspace.speakers}
        sessions={workspace.sessions}
        disclosures={workspace.disclosures}
      />

      {workspace.documents.length > 0 ? <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black">النسخ الأصلية المحفوظة</h2><div className="mt-4 space-y-2">{workspace.documents.map((doc)=><div key={String(doc.id)} className="flex flex-wrap justify-between gap-3 rounded-xl bg-slate-50 p-4 text-sm"><span className="font-bold">{String(doc.original_filename)}</span><span className="font-mono text-xs text-slate-500" dir="ltr">SHA-256 {String(doc.sha256).slice(0,16)}…</span></div>)}</div></section> : null}
    </section>
  );
}
