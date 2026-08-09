'use server';

import { redirect } from 'next/navigation';
import {
  ActivityAuthorizationError,
  ActivityValidationError,
  assignActivityOfficer,
  createActivity,
  type ActivityActionContext,
} from '@/features/activities/service';
import { ActivityPersistenceError } from '@/features/activities/supabase-repository';
import { createRequestActivityRepository } from '@/features/activities/server-repository';
import { requireServerAuthContext } from '@/lib/auth/server-context';

export type ActivityFormState = {
  error: string | null;
};

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toActivityActionContext(
  context: Awaited<ReturnType<typeof requireServerAuthContext>>,
): ActivityActionContext {
  return {
    userId: context.userId,
    organizationId: context.organizationId,
    membershipId: context.membershipId,
    assignedRoles: context.assignedRoles,
    activeRole: context.activeRole,
  };
}

function safeActivityError(error: unknown): ActivityFormState {
  if (error instanceof ActivityValidationError) {
    return { error: 'تحقق من بيانات النشاط والتواريخ ثم أعد المحاولة.' };
  }
  if (error instanceof ActivityAuthorizationError) {
    return { error: 'الدور الحالي لا يملك صلاحية تنفيذ هذا الإجراء.' };
  }
  if (error instanceof ActivityPersistenceError) {
    return { error: 'تعذر حفظ العملية. لم يتم اعتماد أي تغيير غير مكتمل.' };
  }
  return { error: 'حدث خطأ غير متوقع أثناء تنفيذ العملية.' };
}

export async function createActivityAction(
  _previousState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const context = await requireServerAuthContext('activity.create');
  const repository = await createRequestActivityRepository();
  let createdActivity;

  try {
    createdActivity = await createActivity(
      {
        titleAr: optionalString(formData.get('titleAr')) ?? '',
        titleEn: optionalString(formData.get('titleEn')),
        activityType: optionalString(formData.get('activityType')),
        deliveryMethod: optionalString(formData.get('deliveryMethod')),
        plannedStartDate: optionalString(formData.get('plannedStartDate')),
        plannedEndDate: optionalString(formData.get('plannedEndDate')),
        reportingYear: Number(formData.get('reportingYear')),
      },
      toActivityActionContext(context),
      repository,
    );
  } catch (error) {
    return safeActivityError(error);
  }

  redirect(`/admin/activities/${createdActivity.id}/assign`);
}

export async function assignActivityOfficerAction(
  _previousState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const context = await requireServerAuthContext('activity.assign');
  const repository = await createRequestActivityRepository();
  const activityId = optionalString(formData.get('activityId'));
  const membershipId = optionalString(formData.get('membershipId'));

  if (!activityId || !membershipId) {
    return { error: 'اختر مسؤول النشاط قبل الحفظ.' };
  }

  try {
    await assignActivityOfficer(
      activityId,
      membershipId,
      toActivityActionContext(context),
      repository,
    );
  } catch (error) {
    return safeActivityError(error);
  }

  redirect('/admin?assigned=1');
}
