import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getPublicSupabaseEnv } from '@/lib/env';

export function createSupabaseAdminClient(){
  const serverSecret=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serverSecret)throw new Error('A server-only Supabase secret is not configured. User invitation is unavailable until deployment secrets are configured.');
  const {url}=getPublicSupabaseEnv();
  return createClient(url,serverSecret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
