'use server';

import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assessNativeExtractionQuality, extractNativePdfText, mapOfficialFormPages } from '@/features/intake/pdf-extractor';
import { validateIntakeDraft, type IntakeDraft } from '@/features/intake/service';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { removePrivateDocument, uploadPrivateDocument } from '@/lib/storage/private-documents';

export type IntakeActionState = { error: string | null };

const payloadSchema = z.object({
  profile: z.object({ intakeRoute:z.enum(['DIGITAL','PDF','HYBRID']), specialty:z.string(), activityLanguages:z.array(z.string()), collaboration:z.boolean().nullable(), collaboratorOrganizationName:z.string().nullable().optional(), collaboratorType:z.string().nullable().optional(), contentDevelopedByProvider:z.boolean().nullable(), contentDeveloper:z.string().nullable().optional(), targetAudience:z.string(), selectAllMedicalFields:z.boolean(), categorySpecific:z.string().nullable().optional(), learningGap:z.string(), aimAndOutcomes:z.string(), learningMethods:z.string(), participantEvaluationMethod:z.string(), activityScope:z.enum(['LOCAL','INTERNATIONAL']).nullable(), scfhsRegistrationNumber:z.string().nullable().optional(), formStatus:z.enum(['DRAFT','CONFIRMED','SUBMITTED']) }),
  needsAssessmentTools:z.array(z.object({toolCode:z.string(),otherText:z.string().nullable().optional()})),
  objectives:z.array(z.object({objectiveText:z.string(),learningDomain:z.string().nullable().optional(),sortOrder:z.number().int().positive()})),
  committeeMembers:z.array(z.object({fullName:z.string(),classificationNumber:z.string().nullable().optional(),specialty:z.string().nullable().optional(),institution:z.string().nullable().optional(),committeeRole:z.string().nullable().optional(),sortOrder:z.number().int().positive()})),
  speakers:z.array(z.object({clientKey:z.string(),fullName:z.string(),specialty:z.string().nullable().optional(),grade:z.string().nullable().optional(),institution:z.string().nullable().optional(),relatedExperiencePastThreeYears:z.string().nullable().optional(),qualificationsSummary:z.string().nullable().optional(),specialCertificatesSummary:z.string().nullable().optional(),internationalPresentationsCount:z.number().int().nonnegative().nullable().optional(),sortOrder:z.number().int().positive()})),
  sessions:z.array(z.object({dayLabel:z.string().nullable().optional(),topicName:z.string(),startsAt:z.string().nullable().optional(),endsAt:z.string().nullable().optional(),sortOrder:z.number().int().positive(),speakerKeys:z.array(z.string())})),
  disclosures:z.array(z.object({personName:z.string(),personRole:z.string(),declarationStatus:z.enum(['PENDING','DECLARED_NO_CONFLICT','DECLARED_CONFLICT']),commercialRelationshipSummary:z.string().nullable().optional()})),
});

function safeFilename(name:string){const cleaned=name.replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-');return cleaned.slice(-120)||'activity.pdf';}

export async function saveActivityIntakeAction(_previousState:IntakeActionState,formData:FormData):Promise<IntakeActionState>{
  const context=await requireServerAuthContext('activity.fill_submit'); const activityId=String(formData.get('activityId')??''); const payloadText=String(formData.get('payload')??''); const targetStatus=String(formData.get('targetStatus')??'DRAFT')==='CONFIRMED'?'CONFIRMED':'DRAFT'; if(!activityId||!payloadText)return{error:'بيانات النشاط غير مكتملة.'};
  let payload:z.infer<typeof payloadSchema>; try{payload=payloadSchema.parse(JSON.parse(payloadText));payload.profile.formStatus=targetStatus;}catch{return{error:'تعذر التحقق من بيانات النموذج.'};}
  const validationDraft:IntakeDraft={intakeRoute:payload.profile.intakeRoute,titleAr:String(formData.get('activityTitleAr')??''),titleEn:String(formData.get('activityTitleEn')??''),activityType:String(formData.get('activityType')??''),deliveryMethod:String(formData.get('deliveryMethod')??''),specialty:payload.profile.specialty,languages:payload.profile.activityLanguages,targetAudience:payload.profile.targetAudience,learningGap:payload.profile.learningGap,aimAndOutcomes:payload.profile.aimAndOutcomes,learningMethods:payload.profile.learningMethods,participantEvaluationMethod:payload.profile.participantEvaluationMethod};
  const validation=validateIntakeDraft(validationDraft); if(!validation.ok&&targetStatus==='CONFIRMED')return{error:`أكمل الحقول المطلوبة قبل تأكيد النموذج (${validation.missing.join(', ')}).`};
  const supabase=await createServerSupabaseClient(); const {error}=await supabase.rpc('save_activity_intake_command',{p_organization_id:context.organizationId,p_role_context:context.activeRole,p_activity_id:activityId,p_payload:payload}); if(error)return{error:'تعذر حفظ ملف النشاط. لم يتم اعتماد تغيير جزئي.'};
  redirect(`/activities/${activityId}/intake?${targetStatus==='CONFIRMED'?'confirmed':'saved'}=1`);
}

export async function uploadCompletedPdfAction(_previousState:IntakeActionState,formData:FormData):Promise<IntakeActionState>{
  const context=await requireServerAuthContext('activity.fill_submit'); const activityId=String(formData.get('activityId')??''); const file=formData.get('file');
  if(!activityId||!(file instanceof File))return{error:'اختر ملف PDF مكتمل.'}; if(file.type!=='application/pdf')return{error:'المسار يقبل PDF فقط.'}; if(file.size<=0||file.size>20*1024*1024)return{error:'حجم ملف PDF يجب ألا يتجاوز 20 MB.'};
  const bytes=new Uint8Array(await file.arrayBuffer()); const sha256=createHash('sha256').update(bytes).digest('hex'); const storagePath=`${context.organizationId}/${activityId}/${Date.now()}-${safeFilename(file.name)}`; const supabase=await createServerSupabaseClient();
  try{await uploadPrivateDocument({organizationId:context.organizationId,storagePath,bytes,contentType:'application/pdf'});}catch{return{error:'تعذر رفع الملف إلى التخزين الخاص.'};}
  const {data:documentId,error:registerError}=await supabase.rpc('register_intake_document_command',{p_organization_id:context.organizationId,p_role_context:context.activeRole,p_activity_id:activityId,p_document_role:'COMPLETED_ACTIVITY_FORM',p_original_filename:file.name,p_storage_path:storagePath,p_sha256:sha256,p_mime_type:file.type,p_file_size_bytes:file.size});
  if(registerError||!documentId){await removePrivateDocument(context.organizationId,storagePath).catch(()=>undefined);return{error:'تم إلغاء الرفع لأن تسجيل نسخة الأصل لم يكتمل.'};}
  try{
    const pages=await extractNativePdfText(bytes); const fields=mapOfficialFormPages(pages); const quality=assessNativeExtractionQuality(pages,fields);
    const {data:runId,error:extractionError}=await supabase.rpc('complete_extraction_run_command',{p_organization_id:context.organizationId,p_role_context:context.activeRole,p_activity_id:activityId,p_document_id:documentId,p_engine:'NATIVE_PDF',p_fields:fields});
    if(extractionError||!runId)return{error:'حُفظ ملف PDF الأصلي، لكن تعذر تسجيل نتائج الاستخراج. أعد تشغيل الاستخراج لاحقًا.'};
    if(quality.requiresFallback){const {error:fallbackError}=await supabase.rpc('mark_extraction_fallback_required_command',{p_organization_id:context.organizationId,p_role_context:context.activeRole,p_extraction_run_id:runId,p_reason:quality.reason,p_suggested_engine:quality.suggestedEngine});if(fallbackError)return{error:'حُفظ الأصل ونتائج الاستخراج، لكن تعذر تسجيل حالة fallback. راجع الملف يدويًا.'};}
  }catch{return{error:'حُفظ ملف PDF الأصلي، لكن لم يمكن قراءة طبقة النص. لا توجد محاولة تخمين؛ الملف يحتاج OCR معتمد أو تحقق يدوي.'};}
  redirect(`/activities/${activityId}/intake?uploaded=1`);
}

export async function confirmExtractionFieldAction(formData:FormData):Promise<void>{const context=await requireServerAuthContext('activity.fill_submit');const activityId=String(formData.get('activityId')??'');const fieldId=String(formData.get('fieldId')??'');const value=String(formData.get('value')??'');const corrected=String(formData.get('corrected')??'')==='1';if(!activityId||!fieldId)return;const supabase=await createServerSupabaseClient();await supabase.rpc('confirm_extraction_field_command',{p_organization_id:context.organizationId,p_role_context:context.activeRole,p_field_id:fieldId,p_value:value,p_corrected:corrected});redirect(`/activities/${activityId}/intake`);}
export async function applyConfirmedExtractionAction(formData:FormData):Promise<void>{const context=await requireServerAuthContext('activity.fill_submit');const activityId=String(formData.get('activityId')??'');const runId=String(formData.get('runId')??'');if(!activityId||!runId)return;const supabase=await createServerSupabaseClient();await supabase.rpc('apply_confirmed_extraction_command',{p_organization_id:context.organizationId,p_role_context:context.activeRole,p_activity_id:activityId,p_extraction_run_id:runId});redirect(`/activities/${activityId}/intake?applied=1`);}
