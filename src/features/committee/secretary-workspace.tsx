'use client';

import { useMemo, useState } from 'react';
import { createMeetingAction, openReviewAction, recordAttendanceAction } from '@/app/(app)/committee/actions';

type Row=Record<string,unknown>;

export function SecretaryWorkspace({members,meetings,readyActivities}:{members:Row[];meetings:Row[];readyActivities:Row[]}){
  const [attendance,setAttendance]=useState<Record<string,string>>(()=>Object.fromEntries(members.map(m=>[String(m.id),'PRESENT'])));
  const attendanceJson=useMemo(()=>JSON.stringify(members.map(m=>({committeeMemberId:String(m.id),status:attendance[String(m.id)] ?? 'PRESENT'}))),[members,attendance]);
  const input='w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm';
  return <div className="grid gap-6 xl:grid-cols-2">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black">إنشاء اجتماع</h2>
      <form action={createMeetingAction} className="mt-4 grid gap-3">
        <label className="text-sm font-bold">مرجع الاجتماع<input name="meetingReference" className={`${input} mt-2`}/></label>
        <label className="text-sm font-bold">التاريخ والوقت<input name="scheduledAt" type="datetime-local" required className={`${input} mt-2`}/></label>
        <label className="text-sm font-bold">المكان / القناة<input name="location" required className={`${input} mt-2`}/></label>
        <button className="justify-self-end rounded-xl bg-teal-800 px-5 py-3 text-sm font-black text-white">إنشاء الاجتماع</button>
      </form>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black">تسجيل الحضور</h2>
      {meetings.length===0?<p className="mt-4 text-sm text-slate-500">أنشئ اجتماعًا أولًا.</p>:<form action={recordAttendanceAction} className="mt-4 grid gap-3">
        <input type="hidden" name="attendanceJson" value={attendanceJson}/>
        <label className="text-sm font-bold">الاجتماع<select name="meetingId" className={`${input} mt-2`}>{meetings.map(m=><option key={String(m.id)} value={String(m.id)}>{String(m.meeting_reference ?? m.scheduled_at)}</option>)}</select></label>
        <div className="grid gap-2">{members.map(m=><label key={String(m.id)} className="grid grid-cols-[1fr_150px] items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm"><span>{String(m.full_name_snapshot)} · {String(m.committee_role)}</span><select value={attendance[String(m.id)] ?? 'PRESENT'} onChange={e=>setAttendance(current=>({...current,[String(m.id)]:e.target.value}))} className="rounded-lg border border-slate-300 bg-white px-2 py-2"><option>PRESENT</option><option>ABSENT</option><option>EXCUSED</option></select></label>)}</div>
        <button className="justify-self-end rounded-xl border border-teal-800 px-5 py-3 text-sm font-black text-teal-900">حفظ الحضور</button>
      </form>}
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
      <h2 className="text-xl font-black">أنشطة جاهزة للجنة</h2>
      <div className="mt-4 grid gap-3">{readyActivities.length===0?<p className="text-sm text-slate-500">لا توجد أنشطة بحالة READY_FOR_COMMITTEE.</p>:readyActivities.map(a=><form action={openReviewAction} key={String(a.id)} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_280px_auto] md:items-end"><input type="hidden" name="activityId" value={String(a.id)}/><div><div className="font-mono text-xs text-slate-500" dir="ltr">{String(a.activity_code)}</div><div className="mt-1 font-bold">{String(a.title_ar)}</div></div><label className="text-xs font-bold">إسناد إلى اجتماع<select name="meetingId" required className={`${input} mt-2`}><option value="">اختر</option>{meetings.map(m=><option key={String(m.id)} value={String(m.id)}>{String(m.meeting_reference ?? m.scheduled_at)}</option>)}</select></label><button className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">فتح المراجعة</button></form>)}</div>
    </section>
  </div>;
}
