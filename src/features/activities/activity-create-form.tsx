'use client';

import { useActionState } from 'react';
import {
  createActivityAction,
  type ActivityFormState,
} from '@/app/(app)/admin/activities/actions';

const initialState: ActivityFormState = { error: null };

export function ActivityCreateForm() {
  const [state, action, pending] = useActionState(createActivityAction, initialState);
  const currentYear = new Date().getFullYear();

  return (
    <form action={action} className="space-y-6" noValidate>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="titleAr" className="mb-2 block text-sm font-bold text-slate-800">
            اسم النشاط بالعربية <span className="text-red-700">*</span>
          </label>
          <input
            id="titleAr"
            name="titleAr"
            required
            minLength={3}
            maxLength={250}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-sm focus:border-teal-700"
            placeholder="مثال: ورشة تحسين جودة الممارسة الصحية"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="titleEn" className="mb-2 block text-sm font-bold text-slate-800">
            اسم النشاط بالإنجليزية
          </label>
          <input
            id="titleEn"
            name="titleEn"
            dir="ltr"
            maxLength={250}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-left shadow-sm focus:border-teal-700"
            placeholder="Optional"
          />
        </div>

        <div>
          <label htmlFor="reportingYear" className="mb-2 block text-sm font-bold text-slate-800">
            سنة التقرير <span className="text-red-700">*</span>
          </label>
          <input
            id="reportingYear"
            name="reportingYear"
            type="number"
            min={2000}
            max={2200}
            defaultValue={currentYear}
            required
            dir="ltr"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-left shadow-sm focus:border-teal-700"
          />
        </div>

        <div>
          <label htmlFor="activityType" className="mb-2 block text-sm font-bold text-slate-800">
            نوع النشاط
          </label>
          <input
            id="activityType"
            name="activityType"
            maxLength={120}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-sm focus:border-teal-700"
            placeholder="يُستكمل وفق النموذج المعتمد"
          />
        </div>

        <div>
          <label htmlFor="plannedStartDate" className="mb-2 block text-sm font-bold text-slate-800">
            تاريخ البداية المخطط
          </label>
          <input
            id="plannedStartDate"
            name="plannedStartDate"
            type="date"
            dir="ltr"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-left shadow-sm focus:border-teal-700"
          />
        </div>

        <div>
          <label htmlFor="plannedEndDate" className="mb-2 block text-sm font-bold text-slate-800">
            تاريخ النهاية المخطط
          </label>
          <input
            id="plannedEndDate"
            name="plannedEndDate"
            type="date"
            dir="ltr"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-left shadow-sm focus:border-teal-700"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="deliveryMethod" className="mb-2 block text-sm font-bold text-slate-800">
            طريقة التنفيذ
          </label>
          <input
            id="deliveryMethod"
            name="deliveryMethod"
            maxLength={120}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-sm focus:border-teal-700"
            placeholder="سيتم ضبط الخيارات الرسمية في Phase 2"
          />
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-teal-800 px-6 py-3 font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'جارٍ إنشاء النشاط…' : 'إنشاء النشاط والمتابعة للإسناد'}
        </button>
      </div>
    </form>
  );
}
