type EnvLike = Record<string, string | undefined>;

const unsafeValuePattern = /^(?:test(?:[-_].*)?|example(?:[-_].*)?|placeholder|change[-_]?me|changeme|your[-_].*|local[-_].*)$/i;

function required(env: EnvLike, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required runtime environment variable: ${name}.`);
  return value;
}

function isProduction(env: EnvLike): boolean {
  return env.NODE_ENV === 'production';
}

function assertProductionPublicUrl(url: string): void {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Production Supabase URL must be a valid HTTPS URL.'); }
  if (parsed.protocol !== 'https:') throw new Error('Production Supabase URL must use HTTPS.');
  if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(parsed.hostname)) {
    throw new Error('Production Supabase URL must not use localhost.');
  }
  if (parsed.hostname === 'example.supabase.co' || parsed.hostname.endsWith('.example.com')) {
    throw new Error('Production Supabase URL must not use a placeholder host.');
  }
}

function assertProductionCredential(value: string, label: string): void {
  if (value.length < 16 || unsafeValuePattern.test(value) || /placeholder|change[-_]?me|example/i.test(value)) {
    throw new Error(`Production ${label} must not use a placeholder credential.`);
  }
}

export function readPublicRuntimeEnv(env: EnvLike = process.env): { url: string; anonKey: string } {
  if (env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_SECRET_KEY) {
    throw new Error('Server credentials must never be exposed through NEXT_PUBLIC environment variables.');
  }

  const url = required(env, 'NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)?.trim();
  if (!anonKey) throw new Error('Missing required public Supabase credential.');

  if (isProduction(env)) {
    assertProductionPublicUrl(url);
    assertProductionCredential(anonKey, 'public credential');
  }

  return { url, anonKey };
}

export function readServerRuntimeEnv(env: EnvLike = process.env): { url: string; anonKey: string; serviceRoleKey: string } {
  const publicConfig = readPublicRuntimeEnv(env);
  const serviceRoleKey = (env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!serviceRoleKey) throw new Error('Missing required Supabase server secret.');

  if (isProduction(env)) {
    assertProductionCredential(serviceRoleKey, 'server secret');
    if (serviceRoleKey === publicConfig.anonKey) throw new Error('Supabase server secret must be distinct from the public credential.');
  }

  return { ...publicConfig, serviceRoleKey };
}
