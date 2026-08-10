'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function safe(name:string){return name.replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-120)||'template.pdf';}
export async function uploadTemplateVersionAction(formData:FormData){
  const c=await requireServerAuthContext('template.manage'); const file=formData.get('file'); if(!(file instanceof File)||file.size<=0||file.size>20*1024*1024)throw new Error('Invalid template file');
  const allowed=new Set(['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']); if(!allowed.has(file.type))throw new Error('Template must be PDF or DOCX');
  const bytes=new Uint8Array(await file.arrayBuffer()); const checksum=createHash('sha256').update(bytes).digest('hex'); const s=await createServerSupabaseClient(); const path=`${c.organizationId}/templates/${Date.now()}-${safe(file.name)}`;
  const upload=await s.storage.from('cpd-documents').upload(path,bytes,{contentType:file.type,upsert:false}); if(upload.error)throw new Error(upload.error.message);
  let mapping:unknown=[]; try{mapping=JSON.parse(String(formData.get('mappingJson')??'[]'));}catch{await s.storage.from('cpd-documents').remove([path]);throw new Error('Invalid mapping JSON');}
  const {error}=await s.rpc('create_template_version_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_template_code:String(formData.get('templateCode')??''),p_family:String(formData.get('family')??''),p_name_ar:String(formData.get('nameAr')??''),p_name_en:String(formData.get('nameEn')??'')||null,p_version:String(formData.get('version')??''),p_source_reference:String(formData.get('sourceReference')??'')||null,p_storage_path:path,p_checksum:checksum,p_mapping:mapping});
  if(error){await s.storage.from('cpd-documents').remove([path]);throw new Error(error.message);} revalidatePath('/admin/templates');
}
export async function markTemplateQaAction(formData:FormData){const c=await requireServerAuthContext('template.manage');const s=await createServerSupabaseClient();const {error}=await s.rpc('mark_template_qa_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_template_version_id:String(formData.get('versionId')??''),p_visual_qa:String(formData.get('visualQa')??''),p_regression_qa:String(formData.get('regressionQa')??'')});if(error)throw new Error(error.message);revalidatePath('/admin/templates');}
export async function activateTemplateAction(formData:FormData){const c=await requireServerAuthContext('template.approve');const s=await createServerSupabaseClient();const {error}=await s.rpc('activate_template_version_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_template_version_id:String(formData.get('versionId')??''),p_effective_from:String(formData.get('effectiveFrom')??'')});if(error)throw new Error(error.message);revalidatePath('/admin/templates');}
