import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/print-button';
import { OfficialFormPrint } from '@/features/official-form/official-form-print';
import type { OfficialFormValues } from '@/features/official-form/field-map';
import { roleHasPermission } from '@/lib/auth/permissions';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function OfficialFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireServerAuthContext();
  if (!roleHasPermission(context.activeRole, 'activity.view.all')
    && !roleHasPermission(context.activeRole, 'activity.view.assigned')) notFound();
  const supabase = await createServerSupabaseClient();
  const [activityResult, profileResult, objectivesResult, speakerResult] = await Promise.all([
    supabase.from('activities').select('id,title_ar,title_en,planned_start_date,planned_end_date').eq('organization_id', context.organizationId).eq('id', id).maybeSingle(),
    supabase.from('activity_intake_profiles').select('specialty,collaborator_organization_name,target_audience,category_specific,learning_gap,aim_and_outcomes,learning_methods,participant_evaluation_method,scfhs_registration_number').eq('organization_id', context.organizationId).eq('activity_id', id).maybeSingle(),
    supabase.from('activity_learning_objectives').select('objective_text,sort_order').eq('organization_id', context.organizationId).eq('activity_id', id).order('sort_order'),
    supabase.from('activity_speakers').select('speaker_id,full_name_snapshot,specialty_snapshot').eq('organization_id', context.organizationId).eq('activity_id', id).order('sort_order').limit(1).maybeSingle(),
  ]);
  if (activityResult.error || !activityResult.data || profileResult.error || objectivesResult.error || speakerResult.error) notFound();
  let contact: { mobile: string | null; email: string | null } | null = null;
  if (speakerResult.data?.speaker_id && roleHasPermission(context.activeRole, 'activity.fill_submit')) {
    const { data } = await supabase.from('speakers').select('mobile,email').eq('organization_id', context.organizationId).eq('id', speakerResult.data.speaker_id).maybeSingle();
    contact = data;
  }
  const profile = profileResult.data;
  const values: OfficialFormValues = {
    titleEn: activityResult.data.title_en,
    titleAr: activityResult.data.title_ar,
    specialty: profile?.specialty,
    plannedStartDate: activityResult.data.planned_start_date,
    plannedEndDate: activityResult.data.planned_end_date,
    collaboratorName: profile?.collaborator_organization_name,
    targetAudience: profile?.category_specific ?? profile?.target_audience,
    learningGap: profile?.learning_gap,
    aimAndOutcomes: profile?.aim_and_outcomes,
    learningObjectives: (objectivesResult.data ?? []).map((row) => row.objective_text).join(' • '),
    learningMethods: profile?.learning_methods,
    participantEvaluationMethod: profile?.participant_evaluation_method,
    speakerName: speakerResult.data?.full_name_snapshot,
    speakerSpecialty: speakerResult.data?.specialty_snapshot,
    speakerMobile: contact?.mobile,
    speakerEmail: contact?.email,
    scfhsRegistrationNumber: profile?.scfhs_registration_number,
  };
  return <section className="space-y-4">
    <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div><Link href={`/activities/${id}/dossier`} className="text-xs font-black text-teal-800">← العودة إلى ملف النشاط</Link><h1 className="mt-1 text-xl font-black">النموذج الرسمي المطابق للمصدر</h1><p className="mt-1 text-xs text-slate-500">6 صفحات US Letter. استخدم إعداد الطباعة: الحجم الفعلي 100% دون Fit to page.</p></div><PrintButton /></div>
    <OfficialFormPrint values={values} />
  </section>;
}
