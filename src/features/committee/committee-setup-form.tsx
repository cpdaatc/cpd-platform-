'use client';

import { useMemo, useState } from 'react';
import { configureInstitutionalCommitteeAction } from '@/app/(app)/committee/actions';

type Person={membershipId:string;userId:string;displayName:string};

export function CommitteeSetupForm({people}:{people:Person[]}){
  const [chair,setChair]=useState(people[0]?.userId ?? '');
  const [secretary,setSecretary]=useState(people[1]?.userId ?? people[0]?.userId ?? '');
  const [members,setMembers]=useState<string[]>([]);
  const byId=useMemo(()=>new Map(people.map(p=>[p.userId,p])),[people]);
  const membersJson=JSON.stringify([
    ...(chair&&byId.get(chair)?[{userId:chair,fullName:byId.get(chair)!.displayName,committeeRole:'CHAIR'}]:[]),
    ...(secretary&&byId.get(secretary)?[{userId:secretary,fullName:byId.get(secretary)!.displayName,committeeRole:'SECRETARY'}]:[]),
    ...members.filter(id=>id!==chair&&id!==secretary&&byId.get(id)).map(id=>({userId:id,fullName:byId.get(id)!.displayName,committeeRole:'MEMBER'})),
  ]);
  const input='w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm';
  return <form action={configureInstitutionalCommitteeAction} className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
    <input type="hidden" name="membersJson" value={membersJson}/>
    <label className="text-sm font-bold">اسم اللجنة<input name="committeeName" required defaultValue="Institutional Scientific Review Committee" className={`${input} mt-2`}/></label>
    <label className="text-sm font-bold">مرجع قرار التشكيل<input name="appointmentReference" required className={`${input} mt-2`}/></label>
    <label className="text-sm font-bold">تاريخ القرار<input name="appointmentDate" type="date" className={`${input} mt-2`}/></label>
    <label className="text-sm font-bold">جهة التعيين<input name="appointedBy" defaultValue="Hospital Management" className={`${input} mt-2`}/></label>
    <label className="text-sm font-bold">ساري من<input name="effectiveFrom" required type="date" className={`${input} mt-2`}/></label>
    <label className="text-sm font-bold">ساري إلى<input name="effectiveTo" type="date" className={`${input} mt-2`}/></label>
    <label className="text-sm font-bold">رئيس اللجنة<select name="chairUi" value={chair} onChange={e=>setChair(e.target.value)} className={`${input} mt-2`}>{people.map(p=><option key={p.userId} value={p.userId}>{p.displayName}</option>)}</select></label>
    <label className="text-sm font-bold">سكرتير اللجنة<select name="secretaryUi" value={secretary} onChange={e=>setSecretary(e.target.value)} className={`${input} mt-2`}>{people.map(p=><option key={p.userId} value={p.userId}>{p.displayName}</option>)}</select></label>
    <fieldset className="md:col-span-2"><legend className="text-sm font-bold">أعضاء اللجنة</legend><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{people.map(p=><label key={p.userId} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={members.includes(p.userId)} onChange={e=>setMembers(current=>e.target.checked?[...current,p.userId]:current.filter(id=>id!==p.userId))}/><span>{p.displayName}</span></label>)}</div></fieldset>
    <div className="md:col-span-2 flex justify-end"><button className="rounded-xl bg-teal-800 px-5 py-3 text-sm font-black text-white">حفظ تشكيل اللجنة</button></div>
  </form>;
}
