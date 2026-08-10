'use server';

import { revalidatePath } from 'next/cache';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function inviteOrganizationUserAction(formData:FormData):Promise<void>{
  const c=await requireServerAuthContext('organization.users.manage'); const email=String(formData.get('email')??'').trim().toLowerCase(); const fullName=String(formData.get('fullName')??'').trim();
  if(!email||!email.includes('@'))throw new Error('Valid email is required.');
  const admin=createSupabaseAdminClient(); const {data,error}=await admin.auth.admin.inviteUserByEmail(email,{data:fullName?{full_name:fullName}:undefined}); if(error)throw new Error(error.message); if(!data.user?.id)throw new Error('Invitation did not return a user identifier.');
  const s=await createServerSupabaseClient(); const {error:membershipError}=await s.rpc('ensure_organization_membership_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_user_id:data.user.id}); if(membershipError)throw new Error(membershipError.message); revalidatePath('/admin/users');
}

export async function setOrganizationUserRolesAction(formData:FormData):Promise<void>{
  const c=await requireServerAuthContext('organization.roles.manage'); const membershipId=String(formData.get('membershipId')??''); const roles=formData.getAll('roles').map(String);
  const s=await createServerSupabaseClient(); const {error}=await s.rpc('set_organization_user_roles_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_membership_id:membershipId,p_role_codes:roles}); if(error)throw new Error(error.message); revalidatePath('/admin/users');
}

export async function setMembershipStatusAction(formData:FormData):Promise<void>{
  const c=await requireServerAuthContext('organization.users.manage'); const s=await createServerSupabaseClient(); const {error}=await s.rpc('set_organization_membership_status_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_membership_id:String(formData.get('membershipId')??''),p_status:String(formData.get('status')??'')}); if(error)throw new Error(error.message); revalidatePath('/admin/users');
}
