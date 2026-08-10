import { readPublicRuntimeEnv } from '@/lib/config/runtime-env';

export function getPublicSupabaseEnv() {
  return readPublicRuntimeEnv();
}
