import Link from 'next/link';
import { getReadinessWorkspace } from '@/features/ai-review/queries';
import { reviewObjective } from '@/features/ai-review/rules-engine';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { runPreReviewAction } from './actions';

function statusClass(status: string): string {
  if (status === 'ALIGNED') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (status === 'NEEDS_IMPROVEMENT' || status === 'HUMAN_REVIEW_REQUIRED') return 'bg-amber-50 text-amber-900 border-amber-200';
  return 'bg-red-50 text-red-800 border-red-200';
}

export default async function ReadinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireServerAuthContext('ai.run_prereview');
  const workspace = await getReadinessWorkspace(id, context.organizationId);

  return (
    <section className="space-y-7">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/activities/${id}/intake`} className="font-bold text-teal-800 hover:underline">ملف النشاط</Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-500">Accreditation Readiness Review</span>
      </div>

      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-teal-800">SCFHS Accreditation Readiness Review</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="font-mono text-xs font-bold text-slate-500" dir="ltr">{workspace.activity.activityCode}</div>
            <h1 className="mt-2 text-3xl font-black text-slate-950">{workspace.activity.titleAr}</h1>
            {workspace.activity.titleEn ? <p className="mt-1 text-sm text-slate-500" dir="ltr">{workspace.activity.titleEn}</p> : null}
          </div>
          <form action={runPreReviewAction}>
            <input type="hidden" name="activityId" value={id}/>
            <button className="rounded-xl bg-teal-800 px-5 py-3 text-sm font-black text-white hover:bg-teal-900">تشغيل Pre‑Review</button>
          </form>
        </div>
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
          هذه مراجعة جاهزية داخلية مساعدة وليست قرار اعتماد، ولا تمنح النشاط اعتماد الهيئة أو الساعات. القرار الداخلي النهائي يبقى لرئيس اللجنة، والاعتماد الخارجي للهيئة السعودية للتخصصات الصحية.
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-500">External AI</div>
          <div className="mt-2 text-xl font-black text-slate-950">{workspace.externalAiPolicy.externalAiEnabled ? 'مفعّل بسياسة معتمدة' : 'معطّل'}</div>
          <p className="mt-2 text-xs leading-6 text-slate-600">Privacy approval: {workspace.externalAiPolicy.privacyApproved ? 'Approved' : 'Not approved'}</p>
          <p className="text-xs leading-6 text-slate-600">المرحلة الحالية تعمل بالقواعد الحتمية حتى بدون مزود AI خارجي.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-500">Source Conflicts</div>
          <div className="mt-2 text-3xl font-black text-slate-950">{workspace.openSourceConflicts}</div>
          <p className="mt-2 text-xs leading-6 text-slate-600">أي تعارض مفتوح يحتاج حسمًا بشريًا موثقًا، ولا تختار المنصة مصدرًا بصمت.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-500">آخر مراجعة</div>
          <div className="mt-2 text-lg font-black text-slate-950">{workspace.latestReview ? 'Completed' : 'لم تُشغّل بعد'}</div>
          {workspace.latestReview ? <p className="mt-2 font-mono text-xs text-slate-500" dir="ltr">Ruleset {String(workspace.latestReview.ruleset_version ?? '—')}</p> : null}
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black text-slate-950">Objective Quality Check</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">المراجعة هنا تتحقق من قابلية القياس والفعل المستخدم فقط؛ لا تنشئ Target أو Baseline أو زمنًا غير موجود في بيانات النشاط.</p>
        <div className="mt-5 space-y-3">
          {workspace.objectives.length === 0 ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">لا توجد أهداف مسجلة.</p> : workspace.objectives.map((objective,index) => {
            const result=reviewObjective(objective.objectiveText);
            return <article key={objective.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-bold text-slate-500">Objective {index+1}{objective.learningDomain ? ` · ${objective.learningDomain}` : ''}</div><p className="mt-2 text-sm font-bold leading-7 text-slate-900">{objective.objectiveText}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(result.status)}`}>{result.status}</span></div>
              <p className="mt-3 text-xs leading-6 text-slate-600">{result.message}</p>
            </article>;
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950">Latest Pre‑Review Findings</h2><p className="mt-1 text-sm text-slate-600">كل Finding يحتفظ بالقاعدة والمصدر والإصدار ومكان الدليل.</p></div></div>
        <div className="mt-5 space-y-3">
          {workspace.findings.length === 0 ? <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">شغّل Pre‑Review لإنتاج المراجعة الحالية.</p> : workspace.findings.map((finding) => {
            const status=String(finding.status); const severity=String(finding.severity);
            return <article key={String(finding.id)} className="rounded-xl border border-slate-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-mono text-xs font-bold text-slate-500" dir="ltr">{String(finding.rule_code)} · {String(finding.source_code)} · {String(finding.source_version)}</div><h3 className="mt-2 text-sm font-black text-slate-950">{status}</h3></div><span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(status)}`}>{severity}</span></div>
              <div className="mt-4 grid gap-4 md:grid-cols-2"><div><div className="text-xs font-bold text-slate-500">Rationale</div><p className="mt-1 text-sm leading-7 text-slate-700">{String(finding.rationale)}</p></div><div><div className="text-xs font-bold text-slate-500">Recommendation</div><p className="mt-1 text-sm leading-7 text-slate-700">{String(finding.recommendation)}</p></div></div>
              <div className="mt-4 border-t border-slate-100 pt-3 font-mono text-xs text-slate-500" dir="ltr">Evidence: {String(finding.evidence_location)} · Confidence {Math.round(Number(finding.confidence)*100)}%</div>
            </article>;
          })}
        </div>
      </section>
    </section>
  );
}
