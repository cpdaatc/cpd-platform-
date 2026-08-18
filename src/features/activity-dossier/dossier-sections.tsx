import Link from 'next/link';
import type { ActivityDossier, DossierDocument, DossierDocumentCategory } from './contract';
import { getInternalStateLabel } from '@/features/activities/status-labels';
import { uploadEvidenceAction } from '@/app/(app)/activities/[id]/intake/file-actions';

const CATEGORY_LABELS: Record<DossierDocumentCategory, string> = {
  OFFICIAL_FORM: 'النموذج الرسمي المرفوع',
  COMMITTEE_DECISION: 'قرار اللجنة الداخلي',
  COMMITTEE_MINUTES: 'محضر اللجنة',
  FINAL_IMPACT_REPORT: 'تقرير الأثر النهائي',
  ADDITIONAL_ATTACHMENT: 'مرفق إضافي',
};

function DownloadLink({ activityId, document }: { activityId: string; document: DossierDocument }) {
  return <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-800" href={`/api/activities/${activityId}/documents/${document.id}?kind=${document.sourceKind}`}>
    فتح / تحميل
  </Link>;
}

function DocumentList({ activityId, documents, empty }: { activityId: string; documents: DossierDocument[]; empty: string }) {
  if (documents.length === 0) return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{empty}</p>;
  return <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
    {documents.map((document) => <div key={`${document.sourceKind}-${document.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <strong className="block text-sm">{document.filename}</strong>
        <span className="mt-1 block text-xs text-slate-500">{CATEGORY_LABELS[document.category]} · الإصدار {document.version}{document.verificationState ? ` · ${document.verificationState}` : ''}</span>
      </div>
      <DownloadLink activityId={activityId} document={document} />
    </div>)}
  </div>;
}

function Panel({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return <section id={id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <h2 className="text-lg font-black text-slate-950">{title}</h2>
    <div className="mt-4">{children}</div>
  </section>;
}

export function DossierSections({ dossier, canUpload, canManageImpact }: {
  dossier: ActivityDossier;
  canUpload: boolean;
  canManageImpact: boolean;
}) {
  const { activity } = dossier;
  const byCategory = (category: DossierDocumentCategory) => dossier.documents.filter((document) => document.category === category);
  const official = byCategory('OFFICIAL_FORM');
  const decisions = byCategory('COMMITTEE_DECISION');
  const minutes = byCategory('COMMITTEE_MINUTES');
  const impact = byCategory('FINAL_IMPACT_REPORT');
  const attachments = byCategory('ADDITIONAL_ATTACHMENT');

  return <div className="grid gap-5 lg:grid-cols-[1fr_320px]" dir="rtl">
    <div className="space-y-5">
      <Panel title="1. ملخص النشاط">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-xs font-bold text-slate-500">رمز النشاط</dt><dd className="mt-1 font-mono font-black" dir="ltr">{activity.activityCode}</dd></div>
          <div><dt className="text-xs font-bold text-slate-500">القسم</dt><dd className="mt-1 font-black">{activity.department.nameAr ?? activity.department.nameEn ?? '—'}</dd></div>
          <div><dt className="text-xs font-bold text-slate-500">السنة</dt><dd className="mt-1 font-black">{activity.reportingYear}</dd></div>
          <div><dt className="text-xs font-bold text-slate-500">حالة دورة العمل</dt><dd className="mt-1 font-black">{getInternalStateLabel(activity.internalState)}</dd></div>
          <div><dt className="text-xs font-bold text-slate-500">مسؤول النشاط</dt><dd className="mt-1 font-black">{dossier.assignedOfficer?.displayName ?? '—'}</dd></div>
          <div><dt className="text-xs font-bold text-slate-500">قرار اللجنة</dt><dd className="mt-1 font-black">{activity.committeeDecision ?? 'لم يصدر'}</dd></div>
        </dl>
      </Panel>

      <Panel title="2. النموذج الرسمي">
        <p className="mb-3 text-xs leading-6 text-slate-600">النموذج المرفوع محفوظ كما هو. معاينة الطباعة الرسمية مستقلة ومقيدة بست صفحات Letter.</p>
        <div className="mb-3 flex flex-wrap gap-2"><Link className="rounded-lg bg-teal-900 px-3 py-2 text-xs font-black text-white" href={`/activities/${activity.id}/official-form`}>معاينة وطباعة النموذج الرسمي</Link><Link className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black" href={`/activities/${activity.id}/intake`}>تعبئة بيانات النموذج</Link></div>
        <DocumentList activityId={activity.id} documents={official} empty="لا توجد نسخة رسمية مرفوعة لهذا النشاط." />
      </Panel>

      <Panel title="3. قرار اللجنة والمحضر">
        <div className="space-y-3"><DocumentList activityId={activity.id} documents={decisions} empty="لم يصدر قرار اللجنة الداخلي بعد." /><DocumentList activityId={activity.id} documents={minutes} empty="لا يوجد محضر لجنة مرتبط بهذا النشاط بعد." /></div>
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-950">أي موافقة معروضة هنا هي موافقة داخلية للجاهزية للرفع إلى الهيئة، وليست اعتمادًا صادرًا من الهيئة.</p>
      </Panel>

      <Panel title="4. تحليل وقياس الأثر">
        <div className="mb-3 flex flex-wrap gap-2"><Link className="rounded-lg bg-violet-900 px-3 py-2 text-xs font-black text-white" href={`/impact/${activity.id}`}>{canManageImpact ? 'تعبئة L1–L4 وإصدار التقرير' : 'عرض تحليل الأثر'}</Link></div>
        <DocumentList activityId={activity.id} documents={impact} empty="لم يصدر تقرير أثر نهائي لهذا النشاط بعد." />
      </Panel>

      <Panel title="5. المرفقات الإضافية">
        <DocumentList activityId={activity.id} documents={attachments} empty="لا توجد مرفقات إضافية." />
        {canUpload ? <form action={uploadEvidenceAction} className="mt-4 grid gap-3 rounded-xl border border-dashed border-teal-300 bg-teal-50/50 p-4 sm:grid-cols-2">
          <input type="hidden" name="activityId" value={activity.id} />
          <input type="hidden" name="returnTo" value="dossier" />
          <label className="text-xs font-bold">نوع المرفق<input required name="evidenceType" placeholder="مثال: ATTENDANCE" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
          <label className="text-xs font-bold">الملف<input required name="file" type="file" accept=".pdf,.docx,.jpg,.jpeg,.png" className="mt-1 block w-full text-xs" /></label>
          <label className="text-xs font-bold sm:col-span-2">ملاحظات<input name="notes" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
          <button className="rounded-lg bg-teal-900 px-4 py-2 text-xs font-black text-white sm:col-span-2">رفع المرفق كإصدار محفوظ</button>
        </form> : null}
      </Panel>
    </div>

    <aside className="space-y-5">
      <Panel title="6. الجاهزية">
        <div className="grid grid-cols-2 gap-2 text-center text-xs"><div className="rounded-xl bg-teal-50 p-3"><strong className="block text-2xl text-teal-950">{activity.committeeComplete}/5</strong>قبل اللجنة</div><div className="rounded-xl bg-violet-50 p-3"><strong className="block text-2xl text-violet-950">{activity.postActivityComplete}/1</strong>ما بعد النشاط</div></div>
        <ul className="mt-4 space-y-2">{dossier.requirements.map((requirement) => <li key={requirement.code} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs"><span>{requirement.labelAr}</span><strong className={requirement.state === 'VERIFIED' ? 'text-teal-800' : 'text-rose-700'}>{requirement.state === 'VERIFIED' ? 'مكتمل' : 'فجوة'}</strong></li>)}</ul>
      </Panel>
      <Panel title="7. سجل التدقيق">
        {dossier.auditEvents.length === 0 ? <p className="text-xs text-slate-500">لا توجد أحداث مسجلة.</p> : <ol className="space-y-3">{dossier.auditEvents.slice(0, 12).map((event) => <li key={event.id} className="border-r-2 border-teal-300 pr-3 text-xs leading-5"><strong className="block">{event.action}</strong><span className="text-slate-500">{event.actorName ?? 'النظام'} · {new Date(event.occurredAt).toLocaleString('ar-SA')}</span></li>)}</ol>}
      </Panel>
    </aside>
  </div>;
}
