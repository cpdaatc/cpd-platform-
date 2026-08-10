import Link from 'next/link';
import { CollectiveReviewForm } from '@/features/committee/collective-review-form';
import { getCommitteeReviewWorkspace } from '@/features/committee/queries';
import { roleHasPermission } from '@/lib/auth/permissions';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import {
  addCommitteeCommentAction,
  draftMinutesAction,
  finalDecisionAction,
  finalizeMinutesAction,
} from '../../actions';

export default async function CommitteeReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireServerAuthContext();
  const workspace = await getCommitteeReviewWorkspace(id, context.organizationId);
  const canRecord = roleHasPermission(context.activeRole, 'committee.record_collective');
  const canComment = roleHasPermission(context.activeRole, 'committee.comment');
  const canDecide = roleHasPermission(context.activeRole, 'activity.final_decision');
  const canDraftMinutes = roleHasPermission(context.activeRole, 'minutes.draft');
  const canFinalizeMinutes = context.activeRole === 'COMMITTEE_CHAIR';
  const latestMinutes = workspace.minutes[0] ?? null;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/committee/secretary" className="font-bold text-teal-800 hover:underline">مساحة اللجنة</Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-500">مراجعة النشاط</span>
      </div>

      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="font-mono text-xs font-bold text-slate-500" dir="ltr">{String(workspace.activity.activity_code)}</div>
        <h1 className="mt-2 text-3xl font-black text-slate-950">{String(workspace.activity.title_ar)}</h1>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4"><span className="block text-xs text-slate-500">Revision</span><strong>#{String(workspace.revision.revision_no)}</strong></div>
          <div className="rounded-xl bg-slate-50 p-4"><span className="block text-xs text-slate-500">Review status</span><strong>{String(workspace.review.status)}</strong></div>
          <div className="rounded-xl bg-slate-50 p-4"><span className="block text-xs text-slate-500">Internal state</span><strong>{String(workspace.activity.internal_state)}</strong></div>
        </div>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
          قرار اللجنة في المنصة قرار داخلي على جاهزية الرفع فقط، ولا يمثل اعتماد الهيئة للنشاط أو الساعات.
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black">التقييم الجماعي</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">MEET / PARTIAL / NOT_MEET هي النتيجة الجماعية الرسمية وليست درجات فردية للأعضاء.</p>
        <div className="mt-5">
          {canRecord ? <CollectiveReviewForm reviewId={id} existing={workspace.results} /> : (
            <div className="space-y-2">
              {workspace.results.length === 0 ? <p className="text-sm text-slate-500">لم يسجل التقييم الجماعي بعد.</p> : workspace.results.map((row) => (
                <div key={String(row.id)} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <strong>{String(row.criterion_code)} · {String(row.criterion_text)}</strong>
                  <div className="mt-2 text-xs text-slate-600">Evidence: {String(row.evidence_availability)} · Assessment: {String(row.assessment)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">ملاحظات اللجنة</h2>
          <div className="mt-4 space-y-2">
            {workspace.comments.length === 0 ? <p className="text-sm text-slate-500">لا توجد ملاحظات.</p> : workspace.comments.map((row) => (
              <div key={String(row.id)} className="rounded-xl bg-slate-50 p-4 text-sm">{String(row.comment_text)}</div>
            ))}
          </div>
          {canComment ? (
            <form action={addCommitteeCommentAction} className="mt-4 space-y-3">
              <input type="hidden" name="reviewId" value={id} />
              <textarea name="comment" required className="min-h-28 w-full rounded-xl border border-slate-300 p-3" placeholder="أضف ملاحظة علمية موثقة" />
              <button className="rounded-xl border border-teal-800 px-4 py-2.5 text-sm font-bold text-teal-900">إضافة الملاحظة</button>
            </form>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">القرار النهائي الداخلي</h2>
          {workspace.decision ? (
            <div className="mt-4 rounded-xl bg-teal-50 p-4 text-sm text-teal-950">
              <strong>{String(workspace.decision.decision)}</strong>
              {workspace.decision.decision_notes ? <p className="mt-2">{String(workspace.decision.decision_notes)}</p> : null}
            </div>
          ) : canDecide ? (
            <form action={finalDecisionAction} className="mt-4 space-y-3">
              <input type="hidden" name="reviewId" value={id} />
              <select name="decision" required className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3">
                <option value="">اختر القرار</option>
                <option value="APPROVED_FOR_SCFHS_SUBMISSION">معتمد داخليًا للرفع إلى الهيئة</option>
                <option value="RETURNED_FOR_CORRECTION">إعادة للتصحيح</option>
                <option value="NOT_APPROVED">غير معتمد داخليًا</option>
              </select>
              <textarea name="decisionNotes" className="min-h-24 w-full rounded-xl border border-slate-300 p-3" placeholder="ملاحظات القرار" />
              <button className="w-full rounded-xl bg-teal-800 px-4 py-3 text-sm font-black text-white">تسجيل قرار رئيس اللجنة</button>
            </form>
          ) : <p className="mt-4 text-sm text-slate-500">بانتظار قرار رئيس اللجنة.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-black">محضر اللجنة</h2><p className="mt-1 text-sm text-slate-600">المحضر سجل حوكمة داخلي ويحتفظ بإصداراته التاريخية.</p></div>
          <div className="flex gap-2">
            {canDraftMinutes && workspace.decision ? <form action={draftMinutesAction}><input type="hidden" name="reviewId" value={id}/><button className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold">إعداد مسودة المحضر</button></form> : null}
            {canFinalizeMinutes && latestMinutes && String(latestMinutes.status) === 'DRAFT' ? <form action={finalizeMinutesAction}><input type="hidden" name="reviewId" value={id}/><input type="hidden" name="minutesId" value={String(latestMinutes.id)}/><button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">اعتماد المحضر النهائي</button></form> : null}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {workspace.minutes.length === 0 ? <p className="text-sm text-slate-500">لم يُنشأ محضر بعد.</p> : workspace.minutes.map((row) => (
            <div key={String(row.id)} className="flex flex-wrap justify-between gap-3 rounded-xl bg-slate-50 p-4 text-sm"><span>الإصدار {String(row.version_no)}</span><strong>{String(row.status)}</strong></div>
          ))}
        </div>
      </section>
    </section>
  );
}
