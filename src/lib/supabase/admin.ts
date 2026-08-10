import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getPublicSupabaseEnv } from '@/lib/env';

export function createSupabaseAdminClient(){
  const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceRoleKey)throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on the server. User invitation is unavailable until deployment secrets are configured.');
  const {url}=getPublicSupabaseEnv();
  return createClient(url,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
