'use client';

import { useMemo, useState } from 'react';
import { recordL4ObjectivesAction } from '@/app/(app)/impact/actions';

type Objective={objectiveText:string;impactDomain:string;indicator:string;direction:'INCREASE'|'DECREASE';baseline:string;target:string;postValue:string;weight:string;dataSource:string};
const blank=():Objective=>({objectiveText:'',impactDomain:'PATIENT_IMPACT',indicator:'',direction:'INCREASE',baseline:'',target:'',postValue:'',weight:'100',dataSource:''});

export function L4ObjectivesForm({activityId}:{activityId:string}){
  const [rows,setRows]=useState<Objective[]>([blank()]);
  const payload=useMemo(()=>JSON.stringify(rows.map(r=>({...r,baseline:r.baseline===''?null:Number(r.baseline),target:Number(r.target),postValue:Number(r.postValue),weight:Number(r.weight)}))),[rows]);
  const update=(i:number,key:keyof Objective,value:string)=>setRows(current=>current.map((r,index)=>index===i?{...r,[key]:value}:r));
  return <form action={recordL4ObjectivesAction} className="space-y-4">
    <input type="hidden" name="activityId" value={activityId}/><input type="hidden" name="objectivesJson" value={payload}/>
    {rows.map((row,i)=><article key={i} className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3"><strong>هدف أثر {i+1}</strong>{rows.length>1?<button type="button" onClick={()=>setRows(r=>r.filter((_,x)=>x!==i))} className="text-xs font-bold text-red-700">حذف</button>:null}</div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-bold">الهدف<input required value={row.objectiveText} onChange={e=>update(i,'objectiveText',e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5"/></label>
        <label className="text-xs font-bold">المجال<select value={row.impactDomain} onChange={e=>update(i,'impactDomain',e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="PATIENT_IMPACT">أثر المرضى</option><option value="PRACTITIONER_IMPACT">أثر الممارسين</option><option value="QUALITY_SAFETY">الجودة والسلامة</option><option value="SERVICE_EFFICIENCY">كفاءة الخدمة</option></select></label>
        <label className="text-xs font-bold">المؤشر<input value={row.indicator} onChange={e=>update(i,'indicator',e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5"/></label>
        <label className="text-xs font-bold">الاتجاه<select value={row.direction} onChange={e=>update(i,'direction',e.target.value as Objective['direction'])} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="INCREASE">زيادة</option><option value="DECREASE">خفض</option></select></label>
        <label className="text-xs font-bold">خط الأساس<input type="number" step="any" value={row.baseline} onChange={e=>update(i,'baseline',e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5"/></label>
        <label className="text-xs font-bold">المستهدف<input required type="number" min="0" step="any" value={row.target} onChange={e=>update(i,'target',e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5"/></label>
        <label className="text-xs font-bold">بعد النشاط<input required type="number" min="0" step="any" value={row.postValue} onChange={e=>update(i,'postValue',e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5"/></label>
        <label className="text-xs font-bold">الوزن %<input required type="number" min="0.001" step="any" value={row.weight} onChange={e=>update(i,'weight',e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5"/></label>
        <label className="text-xs font-bold md:col-span-2">مصدر البيانات<input value={row.dataSource} onChange={e=>update(i,'dataSource',e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5"/></label>
      </div>
    </article>)}
    <div className="flex flex-wrap justify-between gap-3"><button type="button" onClick={()=>setRows(r=>[...r,blank()])} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold">+ إضافة هدف أثر</button><button className="rounded-xl bg-teal-800 px-5 py-3 text-sm font-black text-white">حفظ L4 وحساب النتيجة</button></div>
  </form>;
}
