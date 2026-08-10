import { describe, expect, it } from 'vitest';
import { readPublicRuntimeEnv, readServerRuntimeEnv } from '@/lib/config/runtime-env';

const publicProd = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: 'https://tenant.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key-1234567890',
};

describe('runtime environment security boundary', () => {
  it('accepts explicit HTTPS public configuration in production', () => {
    expect(readPublicRuntimeEnv(publicProd)).toEqual({
      url: 'https://tenant.supabase.co',
      anonKey: 'public-anon-key-1234567890',
    });
  });

  it.each([
    [{ ...publicProd, NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321' }, 'HTTPS'],
    [{ ...publicProd, NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }, 'placeholder'],
    [{ ...publicProd, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key' }, 'placeholder'],
    [{ ...publicProd, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'leaked-secret' }, 'NEXT_PUBLIC'],
  ])('fails closed for unsafe production public config %#', (env, expected) => {
    expect(() => readPublicRuntimeEnv(env)).toThrow(expected);
  });

  it('requires a non-public server secret in production and keeps it distinct from public credential', () => {
    expect(readServerRuntimeEnv({ ...publicProd, SUPABASE_SECRET_KEY: 'server-secret-key-1234567890' })).toMatchObject({
      url: 'https://tenant.supabase.co',
      serviceRoleKey: 'server-secret-key-1234567890',
    });
    expect(() => readServerRuntimeEnv(publicProd)).toThrow('server secret');
    expect(() => readServerRuntimeEnv({ ...publicProd, SUPABASE_SERVICE_ROLE_KEY: publicProd.NEXT_PUBLIC_SUPABASE_ANON_KEY })).toThrow('distinct');
  });

  it('permits explicit localhost values outside production for deterministic local tests', () => {
    expect(readPublicRuntimeEnv({
      NODE_ENV: 'test',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-anon-key',
    })).toEqual({ url: 'http://127.0.0.1:54321', anonKey: 'local-anon-key' });
  });
});
