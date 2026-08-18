'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { GovernanceRole } from '@/lib/auth/permissions';
import { getInternalStateLabel } from '@/features/activities/status-labels';
import { filterActivityDossiers, type ActivityDossierListItem } from './contract';

type AnnualReportLink = { id: string; reportingYear: number; status: string };

export function ActivityDashboard({
  items,
  annualReports,
  activeRole,
}: {
  items: ActivityDossierListItem[];
  annualReports: AnnualReportLink[];
  activeRole: GovernanceRole;
}) {
  const [year, setYear] = useState<number | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const years = useMemo(
    () => [...new Set(items.map((item) => item.reportingYear))].sort((a, b) => b - a),
    [items],
  );
  const departments = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const item of items) {
      if (item.department.id) {
        map.set(item.department.id, {
          id: item.department.id,
          label: item.department.nameAr ?? item.department.nameEn ?? '—',
        });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'ar'));
  }, [items]);
  const visible = useMemo(
    () => filterActivityDossiers(items, { reportingYear: year, departmentId, search }),
    [items, year, departmentId, search],
  );
  const annualReport = year === null
    ? null
    : annualReports.find((report) => report.reportingYear === year) ?? null;
  const officer = activeRole === 'ACTIVITY_OFFICER';

  return <section className="space-y-5" dir="rtl">
    <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-black uppercase tracking-[.18em] text-teal-700">
        {officer ? 'الأنشطة المسندة لي' : 'سجل الأنشطة المؤسسي'}
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-950">ملفات الأنشطة والاعتماد</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            {officer
              ? 'تظهر فقط الأنشطة المسندة إليك، مع النموذج الرسمي وقرار اللجنة والمحضر وقياس الأثر والمرفقات.'
              : 'استعرض كل نشاط مع حالة الجاهزية والوثائق والتقارير من شاشة واحدة.'}
          </p>
        </div>
        {annualReport ? <Link className="rounded-xl border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-black text-teal-950" href={`/annual-reports/${annualReport.id}`}>
          التقرير السنوي {annualReport.reportingYear}
        </Link> : null}
      </div>
    </header>

    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
      <label className="text-xs font-bold text-slate-700">السنة
        <select aria-label="السنة" value={year ?? ''} onChange={(event) => setYear(event.target.value ? Number(event.target.value) : null)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
          <option value="">كل السنوات</option>
          {years.map((value) => <option value={value} key={value}>{value}</option>)}
        </select>
      </label>
      <label className="text-xs font-bold text-slate-700">القسم
        <select aria-label="القسم" value={departmentId ?? ''} onChange={(event) => setDepartmentId(event.target.value || null)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
          <option value="">كل الأقسام</option>
          {departments.map((department) => <option value={department.id} key={department.id}>{department.label}</option>)}
        </select>
      </label>
      <label className="text-xs font-bold text-slate-700">اسم البرنامج أو رمزه
        <input aria-label="اسم البرنامج أو رمزه" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث عربي / English / Code" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
      </label>
    </div>

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <strong>النتائج</strong><span className="text-xs font-bold text-slate-500">{visible.length} نشاط</span>
      </div>
      {visible.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">لا توجد أنشطة مطابقة للفلاتر الحالية.</div> : <div className="divide-y divide-slate-100">
        {visible.map((activity) => <article key={activity.id} className="grid gap-4 p-5 lg:grid-cols-[1.4fr_.8fr_.8fr_auto] lg:items-center">
          <div>
            <div className="font-mono text-xs font-bold text-slate-500" dir="ltr">{activity.activityCode}</div>
            <h2 className="mt-1 text-lg font-black text-slate-950">{activity.titleAr}</h2>
            {activity.titleEn ? <p className="mt-1 text-xs text-slate-500" dir="ltr">{activity.titleEn}</p> : null}
            <p className="mt-2 text-xs text-slate-500">{activity.department.nameAr ?? activity.department.nameEn ?? 'بدون قسم'} · {activity.reportingYear}</p>
          </div>
          <div className="text-xs leading-6"><span className="block font-bold text-slate-500">حالة النشاط</span><strong>{getInternalStateLabel(activity.internalState)}</strong></div>
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-xl bg-teal-50 p-2"><strong className="block text-lg text-teal-900">{activity.committeeComplete}/5</strong>جاهزية اللجنة</div>
            <div className="rounded-xl bg-violet-50 p-2"><strong className="block text-lg text-violet-900">{activity.postActivityComplete}/1</strong>ما بعد النشاط</div>
          </div>
          <Link href={`/activities/${activity.id}/dossier`} className="rounded-xl bg-teal-900 px-4 py-3 text-center text-sm font-black text-white">فتح الملف</Link>
        </article>)}
      </div>}
    </div>
  </section>;
}
