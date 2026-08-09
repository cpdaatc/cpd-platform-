'use client';

import { useActionState } from 'react';
import {
  assignActivityOfficerAction,
  type ActivityFormState,
} from '@/app/(app)/admin/activities/actions';
import type { AssignableOfficer } from './queries';

const initialState: ActivityFormState = { error: null };

export function ActivityAssignForm({
  activityId,
  officers,
}: {
  activityId: string;
  officers: AssignableOfficer[];
}) {
  const [state, action, pending] = useActionState(assignActivityOfficerAction, initialState);

  if (officers.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
        لا يوجد مستخدم نشط يحمل دور <strong>مسؤول النشاط</strong> في هذه المؤسسة. أضف الدور للمستخدم المطلوب قبل إسناد النشاط.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="activityId" value={activityId} />

      <div>
        <label htmlFor="membershipId" className="mb-2 block text-sm font-bold text-slate-800">
          مسؤول النشاط <span className="text-red-700">*</span>
        </label>
        <select
          id="membershipId"
          name="membershipId"
          required
          defaultValue=""
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-sm focus:border-teal-700"
        >
          <option value="" disabled>
            اختر مسؤول النشاط
          </option>
          {officers.map((officer) => (
            <option key={officer.membershipId} value={officer.membershipId}>
              {officer.displayName}
            </option>
          ))}
        </select>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end border-t border-slate-200 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-teal-800 px-6 py-3 font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'جارٍ الحفظ…' : 'حفظ الإسناد'}
        </button>
      </div>
    </form>
  );
}
