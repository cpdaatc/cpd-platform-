import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { readServerRuntimeEnv } from '@/lib/config/runtime-env';

export function createSupabaseAdminClient(){
  const {url,serviceRoleKey}=readServerRuntimeEnv();
  return createClient(url,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
