import { recordL1Action, recordL2Action, recordL3Action } from '@/app/(app)/impact/actions';

export function ImpactLevelForms({activityId}:{activityId:string}){
  const input='mt-1 w-full rounded-lg border border-slate-300 px-2 py-2';
  return <div className="grid gap-5 xl:grid-cols-3">
    <form action={recordL1Action} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="activityId" value={activityId}/><h2 className="text-lg font-black">L1 — Reaction</h2><p className="mt-1 text-xs text-slate-500">ستة بنود من 1 إلى 5، ويحسب النظام النتيجة.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">{[['content','ملاءمة المحتوى'],['objectives','وضوح الأهداف'],['trainer','كفاءة المدرب'],['organization','تنظيم النشاط'],['applicability','قابلية التطبيق'],['overall','الرضا العام']].map(([name,label])=><label key={name} className="text-[10px] font-bold">{label}<input type="number" min="1" max="5" step="0.1" required name={name} className={input}/></label>)}</div>
      <button className="mt-4 w-full rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white">حفظ L1</button>
    </form>
    <form action={recordL2Action} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="activityId" value={activityId}/><h2 className="text-lg font-black">L2 — Learning</h2><p className="mt-1 text-xs text-slate-500">MIN(Post / Target, 1) × 100</p>
      <label className="mt-4 block text-xs font-bold">الاختبار البعدي<input name="post" type="number" step="any" min="0" required className={input}/></label><label className="mt-3 block text-xs font-bold">المستهدف<input name="target" type="number" step="any" min="0.001" required className={input}/></label>
      <button className="mt-4 w-full rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white">حفظ L2</button>
    </form>
    <form action={recordL3Action} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="activityId" value={activityId}/><h2 className="text-lg font-black">L3 — Behavior</h2><p className="mt-1 text-xs text-slate-500">الحفظ محكوم بتاريخ الاستحقاق في السياسة المعتمدة.</p>
      <label className="mt-4 block text-xs font-bold">نسبة التطبيق الميداني<input name="applicationRate" type="number" step="any" min="0" required className={input}/></label><label className="mt-3 block text-xs font-bold">المستهدف<input name="target" type="number" step="any" min="0.001" required className={input}/></label>
      <button className="mt-4 w-full rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white">حفظ L3</button>
    </form>
  </div>;
}
