import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';
const supabaseOrigin = (() => {
  try { return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : null; }
  catch { return null; }
})();

function contentSecurityPolicy(): string {
  const connectSources = ["'self'", supabaseOrigin].filter(Boolean) as string[];
  if (!isProduction) connectSources.push('http://127.0.0.1:*', 'http://localhost:*', 'ws://127.0.0.1:*', 'ws://localhost:*');
  const scriptSources = ["'self'", "'unsafe-inline'"];
  if (!isProduction) scriptSources.push("'unsafe-eval'");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSources.join(' ')}`,
    `connect-src ${connectSources.join(' ')}`,
  ].join('; ');
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    '/*': ['./scripts/pdf-extractor-worker.mjs'],
  },
  async headers() {
    const headers = [
      { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    ];
    if (isProduction) headers.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' });
    return [{ source: '/(.*)', headers }];
  },
};

export default nextConfig;
