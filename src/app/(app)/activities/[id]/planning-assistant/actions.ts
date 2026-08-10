'use server';

import { revalidatePath } from 'next/cache';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

async function createSuggestion(args:Record<string,unknown>){const c=await requireServerAuthContext('ai.run_prereview');const s=await createServerSupabaseClient();const {error}=await s.rpc('create_planning_suggestion_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,...args});if(error)throw new Error(error.message);}

export async function suggestGapStructureAction(formData:FormData){
  const activityId=String(formData.get('activityId')??''); const source=String(formData.get('sourceText')??'').trim();
  const suggested=source?`${source} مصدر الدليل: [حدد مصدر الدليل الموثق].`:'[صف الفجوة الموثقة دون اختراع معلومات]. مصدر الدليل: [حدد المصدر].';
  await createSuggestion({p_activity_id:activityId,p_suggestion_type:'GAP_STATEMENT',p_target_entity_type:'GAP',p_target_entity_id:null,p_source_text:source||null,p_suggested_text:suggested,p_origin:'DETERMINISTIC'}); revalidatePath(`/activities/${activityId}/planning-assistant`);
}

export async function suggestObjectiveStructureAction(formData:FormData){
  const activityId=String(formData.get('activityId')??''); const objectiveId=String(formData.get('objectiveId')??''); const source=String(formData.get('sourceText')??'').trim();
  const weak=/\b(understand|know|believe|appreciate|aware|familiar)\b|يفهم|يعرف|يدرك|يعي/i.test(source);
  const suggested=weak?'بنهاية النشاط، سيتمكن المشارك من [فعل قابل للقياس] [المحتوى أو المهارة] وفق [معيار القياس إن كان متاحًا].':source;
  await createSuggestion({p_activity_id:activityId,p_suggestion_type:'SMART_OBJECTIVE',p_target_entity_type:'OBJECTIVE',p_target_entity_id:objectiveId,p_source_text:source,p_suggested_text:suggested,p_origin:'DETERMINISTIC'}); revalidatePath(`/activities/${activityId}/planning-assistant`);
}

export async function actPlanningSuggestionAction(formData:FormData){
  const c=await requireServerAuthContext('ai.run_prereview'); const activityId=String(formData.get('activityId')??''); const s=await createServerSupabaseClient(); const action=String(formData.get('action')??'');
  const {error}=await s.rpc('act_on_planning_suggestion_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_suggestion_id:String(formData.get('suggestionId')??''),p_action:action,p_accepted_text:String(formData.get('acceptedText')??'')||null});
  if(error)throw new Error(error.message); revalidatePath(`/activities/${activityId}/planning-assistant`); revalidatePath(`/activities/${activityId}/intake`);
}
