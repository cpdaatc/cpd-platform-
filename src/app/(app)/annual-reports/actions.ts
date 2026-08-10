'use server';

import { revalidatePath } from 'next/cache';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

async function call(name:string,args:Record<string,unknown>){const s=await createServerSupabaseClient();const {data,error}=await s.rpc(name,args);if(error)throw new Error(error.message);return data;}
export async function generateAnnualReportAction(formData:FormData){const c=await requireServerAuthContext('annual.generate');await call('generate_annual_committee_report_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_year:Number(formData.get('year'))});revalidatePath('/annual-reports');}
export async function approveAnnualReportAction(formData:FormData){const c=await requireServerAuthContext('annual.approve_committee');await call('approve_annual_committee_report_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_report_id:String(formData.get('reportId')??'')});revalidatePath('/annual-reports');}
export async function acknowledgeAnnualReportAction(formData:FormData){const c=await requireServerAuthContext('annual.acknowledge');await call('acknowledge_annual_committee_report_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_report_id:String(formData.get('reportId')??''),p_comment:String(formData.get('comment')??'')||null});revalidatePath('/annual-reports');}
