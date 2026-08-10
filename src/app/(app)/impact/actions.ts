'use server';

import { revalidatePath } from 'next/cache';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function num(formData: FormData, key: string): number {
  const value = Number(formData.get(key));
  if (!Number.isFinite(value)) throw new Error(`Invalid ${key}`);
  return value;
}

async function rpc(name:string,args:Record<string,unknown>) {
  const supabase=await createServerSupabaseClient();
  const {data,error}=await supabase.rpc(name,args);
  if(error) throw new Error(error.message);
  return data;
}

export async function configureFollowupPolicyAction(formData:FormData):Promise<void>{
  const c=await requireServerAuthContext('methodology.configure');
  const levels=['L1','L2','L3','L4'].map(level=>({level,dueOffsetDays:num(formData,`${level}Due`),gracePeriodDays:num(formData,`${level}Grace`),required:true}));
  await rpc('configure_impact_followup_policy_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_name:String(formData.get('name')??'Impact Follow-up'),p_version:String(formData.get('version')??''),p_levels:levels});
  revalidatePath('/impact');
}
export async function approveFollowupPolicyAction(formData:FormData):Promise<void>{
  const c=await requireServerAuthContext('methodology.approve');
  await rpc('approve_impact_followup_policy_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_policy_id:String(formData.get('policyId')??'')});
  revalidatePath('/impact');
}
export async function configureMethodologyAction(formData:FormData):Promise<void>{
  const c=await requireServerAuthContext('methodology.configure');
  const weights={L1:num(formData,'L1Weight'),L2:num(formData,'L2Weight'),L3:num(formData,'L3Weight'),L4:num(formData,'L4Weight')};
  const thresholds={excellent:num(formData,'excellent'),very_good:num(formData,'veryGood'),good:num(formData,'good')};
  await rpc('configure_impact_methodology_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_version:String(formData.get('version')??''),p_weights:weights,p_thresholds:thresholds});
  revalidatePath('/impact');
}
export async function approveMethodologyAction(formData:FormData):Promise<void>{
  const c=await requireServerAuthContext('methodology.approve');
  await rpc('approve_impact_methodology_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_methodology_id:String(formData.get('methodologyId')??'')});
  revalidatePath('/impact');
}
export async function markActivityConductedAction(formData:FormData):Promise<void>{
  const c=await requireServerAuthContext('impact.manage'); const activityId=String(formData.get('activityId')??'');
  await rpc('mark_activity_conducted_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_activity_id:activityId,p_conducted_at:String(formData.get('conductedAt')??'')});
  revalidatePath('/impact');revalidatePath(`/impact/${activityId}`);
}
export async function recordL1Action(formData:FormData):Promise<void>{
  const c=await requireServerAuthContext('impact.manage'); const activityId=String(formData.get('activityId')??'');
  const items=['content','objectives','trainer','organization','applicability','overall'].map(k=>num(formData,k));
  if(items.some(v=>v<1||v>5)) throw new Error('L1 ratings must be between 1 and 5');
  const average=items.reduce((a,b)=>a+b,0)/items.length; const score=average/5*100;
  await rpc('record_impact_level_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_activity_id:activityId,p_level:'L1',p_score:score,p_source_data:{items,average}});
  revalidatePath(`/impact/${activityId}`);
}
export async function recordL2Action(formData:FormData):Promise<void>{
  const c=await requireServerAuthContext('impact.manage'); const activityId=String(formData.get('activityId')??''); const post=num(formData,'post'); const target=num(formData,'target');
  if(target<=0) throw new Error('L2 target must be greater than zero'); const score=Math.min(post/target,1)*100;
  await rpc('record_impact_level_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_activity_id:activityId,p_level:'L2',p_score:score,p_source_data:{post,target}});
  revalidatePath(`/impact/${activityId}`);
}
export async function recordL3Action(formData:FormData):Promise<void>{
  const c=await requireServerAuthContext('impact.manage'); const activityId=String(formData.get('activityId')??''); const rate=num(formData,'applicationRate'); const target=num(formData,'target');
  if(target<=0) throw new Error('L3 target must be greater than zero'); const score=Math.min(rate/target,1)*100;
  await rpc('record_impact_level_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_activity_id:activityId,p_level:'L3',p_score:score,p_source_data:{applicationRate:rate,target}});
  revalidatePath(`/impact/${activityId}`);
}
export async function recordL4ObjectivesAction(formData:FormData):Promise<void>{
  const c=await requireServerAuthContext('impact.manage'); const activityId=String(formData.get('activityId')??'');
  let objectives:unknown; try{objectives=JSON.parse(String(formData.get('objectivesJson')??'[]'));}catch{throw new Error('Invalid objective data');}
  await rpc('record_impact_objectives_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_activity_id:activityId,p_objectives:objectives});
  revalidatePath(`/impact/${activityId}`);
}
export async function generateImpactReportAction(formData:FormData):Promise<void>{
  const c=await requireServerAuthContext('impact.finalize'); const activityId=String(formData.get('activityId')??''); const kind=String(formData.get('kind')??'INTERIM');
  await rpc('generate_impact_report_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_activity_id:activityId,p_kind:kind});
  revalidatePath(`/impact/${activityId}`);revalidatePath('/reports');
}
