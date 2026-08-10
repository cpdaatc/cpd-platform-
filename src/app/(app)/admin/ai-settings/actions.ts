'use server';

import { revalidatePath } from 'next/cache';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

async function call(name:string,args:Record<string,unknown>){const c=await requireServerAuthContext();const s=await createServerSupabaseClient();const {error}=await s.rpc(name,{p_organization_id:c.organizationId,p_role_context:c.activeRole,...args});if(error)throw new Error(error.message);revalidatePath('/admin/ai-settings');}
export async function configureExternalAiAction(formData:FormData){await call('configure_external_ai_command',{p_provider:String(formData.get('provider')??''),p_processing_region:String(formData.get('processingRegion')??''),p_retention_policy:String(formData.get('retentionPolicy')??'')||null});}
export async function approveExternalAiAction(formData:FormData){await call('approve_external_ai_command',{p_approval_reference:String(formData.get('approvalReference')??''),p_approval_note:String(formData.get('approvalNote')??'')||null});}
export async function disableExternalAiAction(formData:FormData){await call('disable_external_ai_command',{p_reason:String(formData.get('reason')??'')});}
