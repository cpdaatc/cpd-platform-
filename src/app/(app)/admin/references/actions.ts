'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function safeName(value:string){return value.replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-140)||'reference.pdf';}

export async function uploadReferenceDocumentAction(formData:FormData):Promise<void>{
  const c=await requireServerAuthContext('ai.manage_references');
  const file=formData.get('file');
  if(!(file instanceof File)||file.size<=0||file.size>30*1024*1024)throw new Error('Reference file is required and must not exceed 30 MB.');
  const allowed=new Set(['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
  if(!allowed.has(file.type))throw new Error('Reference source must be PDF or DOCX.');
  const bytes=new Uint8Array(await file.arrayBuffer()); const sha=createHash('sha256').update(bytes).digest('hex');
  const s=await createServerSupabaseClient(); const path=`${c.organizationId}/references/${Date.now()}-${safeName(file.name)}`;
  const upload=await s.storage.from('cpd-documents').upload(path,bytes,{contentType:file.type,upsert:false}); if(upload.error)throw new Error(upload.error.message);
  const {error}=await s.rpc('register_reference_document_command',{
    p_organization_id:c.organizationId,p_role_context:c.activeRole,p_source_code:String(formData.get('sourceCode')??''),p_title:String(formData.get('title')??''),
    p_source_type:String(formData.get('sourceType')??''),p_authority_level:Number(formData.get('authorityLevel')??0),p_version_label:String(formData.get('version')??''),
    p_effective_from:String(formData.get('effectiveFrom')??'')||null,p_effective_to:String(formData.get('effectiveTo')??'')||null,p_source_uri:String(formData.get('sourceUri')??'')||null,
    p_storage_path:path,p_sha256:sha,p_mime_type:file.type,p_file_size_bytes:file.size,p_page_count:null,
  });
  if(error){await s.storage.from('cpd-documents').remove([path]);throw new Error(error.message);}
  revalidatePath('/admin/references');
}
