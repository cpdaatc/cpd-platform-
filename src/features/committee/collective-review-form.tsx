'use client';

import { useMemo, useState } from 'react';
import { recordCollectiveAssessmentAction } from '@/app/(app)/committee/actions';

type Existing=Record<string,unknown>;
const criteria=[
  ['C01','ارتباط موضوع النشاط بالممارسة المهنية واحتياجات الفئة المستهدفة','ACT-GOV-001'],
  ['C02','توثيق الاحتياج أو الفجوة التعليمية وانعكاسها على التخطيط','ACT-NEED-001'],
  ['C03','وضوح الأهداف التعليمية وقابليتها للقياس','ACT-OBJ-001'],
  ['C04','ملاءمة المحتوى والأدلة العلمية للموضوع',''],
  ['C05','ملاءمة خبرات ومؤهلات المتحدثين/المدربين','ACT-SPK-001'],
  ['C06','مواءمة أساليب التعليم والتدريب مع الأهداف','ACT-METHOD-001'],
  ['C07','استكمال الإفصاح عن تضارب المصالح والدعم التجاري','ACT-COI-001'],
  ['C08','وجود وسيلة مناسبة لتقييم تجربة الممارس/المشارك','ACT-EVAL-001'],
  ['C09','وجود تقييم علمي أو عملي عند انطباقه على نوع النشاط',''],
  ['C10','اتساق المحتوى العلمي مع البرنامج/الأجندة',''],
  ['C11','عدم وجود تعارض مؤثر بين الأطراف الداعمة/المنظمة والمحتوى العلمي','ACT-COI-002'],
] as const;

export function CollectiveReviewForm({reviewId,existing}:{reviewId:string;existing:Existing[]}){
  const byCode=new Map(existing.map(r=>[String(r.criterion_code),r]));
  const [values,setValues]=useState(()=>Object.fromEntries(criteria.map(([code])=>{
    const row=byCode.get(code); return [code,{evidence:String(row?.evidence_availability ?? 'UPLOADED'),assessment:String(row?.assessment ?? 'MEET'),notes:String(row?.notes ?? ''),correctiveAction:String(row?.corrective_action ?? '')}];
  })));
  const resultsJson=useMemo(()=>JSON.stringify(criteria.map(([code,text,sourceRuleCode])=>({criterionCode:code,criterionText:text,sourceRuleCode,evidenceAvailability:values[code].evidence,assessment:values[code].assessment,notes:values[code].notes,correctiveAction:values[code].correctiveAction}))),[values]);
  const update=(code:string,key:string,value:string)=>setValues(current=>({...current,[code]:{...current[code],[key]:value}}));
  return <form action={recordCollectiveAssessmentAction} className="space-y-4"><input type="hidden" name="reviewId" value={reviewId}/><input type="hidden" name="resultsJson" value={resultsJson}/><div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">هذه القائمة داخلية/تكوينية في النسخة العامة. ربط النص النهائي والإصدار بالقالب المؤسسي المعتمد يتم عبر Template Versioning، ولا تُعرض كأنها نموذج صادر من الهيئة.</div>{criteria.map(([code,text])=><article key={code} className="rounded-xl border border-slate-200 p-4"><div className="font-bold text-slate-900">{code} · {text}</div><div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-xs font-bold">Evidence Availability<select value={values[code].evidence} onChange={e=>update(code,'evidence',e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option>UPLOADED</option><option>OFFLINE_REVIEWED</option><option>NOT_APPLICABLE</option><option>MISSING</option></select></label><label className="text-xs font-bold">Committee Assessment<select value={values[code].assessment} onChange={e=>update(code,'assessment',e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option>MEET</option><option>PARTIAL</option><option>NOT_MEET</option></select></label><label className="text-xs font-bold">ملاحظات<input value={values[code].notes} onChange={e=>update(code,'notes',e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"/></label><label className="text-xs font-bold">الإجراء التصحيحي<input value={values[code].correctiveAction} onChange={e=>update(code,'correctiveAction',e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"/></label></div></article>)}<div className="flex justify-end"><button className="rounded-xl bg-teal-800 px-5 py-3 text-sm font-black text-white">حفظ التقييم الجماعي</button></div></form>;
}
