'use server';

import { revalidatePath } from 'next/cache';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function requestImpactCorrectionAction(formData:FormData){const c=await requireServerAuthContext();const s=await createServerSupabaseClient();const {error}=await s.rpc('request_impact_correction_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_activity_id:String(formData.get('activityId')??''),p_reason:String(formData.get('reason')??'')});if(error)throw new Error(error.message);revalidatePath('/impact/corrections');}
export async function reviewImpactCorrectionAction(formData:FormData){const c=await requireServerAuthContext();const s=await createServerSupabaseClient();const {error}=await s.rpc('review_impact_correction_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_request_id:String(formData.get('requestId')??''),p_decision:String(formData.get('decision')??''),p_note:String(formData.get('note')??'')||null});if(error)throw new Error(error.message);revalidatePath('/impact/corrections');}
