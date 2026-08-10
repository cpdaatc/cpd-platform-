'use server';

import { revalidatePath } from 'next/cache';
import { requireServerAuthContext } from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function refreshNotificationsAction(){const c=await requireServerAuthContext('notification.view');const s=await createServerSupabaseClient();const {error}=await s.rpc('refresh_governance_notifications_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole});if(error)throw new Error(error.message);revalidatePath('/notifications');}
export async function markNotificationReadAction(formData:FormData){const c=await requireServerAuthContext('notification.view');const s=await createServerSupabaseClient();const {error}=await s.rpc('mark_notification_read_command',{p_organization_id:c.organizationId,p_role_context:c.activeRole,p_notification_id:String(formData.get('notificationId')??'')});if(error)throw new Error(error.message);revalidatePath('/notifications');}
