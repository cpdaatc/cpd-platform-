const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'PRODUCTION_BASE_URL',
];

const errors = [];
for (const name of required) {
  if (!process.env[name]?.trim()) errors.push(`${name} is required.`);
}

const serverSecret = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!serverSecret) errors.push('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required.');

function requireProductionHttps(name) {
  const value = process.env[name]?.trim();
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') errors.push(`${name} must use HTTPS.`);
    if (['localhost', '127.0.0.1', 'example.supabase.co', 'example.com'].includes(url.hostname)) {
      errors.push(`${name} still points to a local or placeholder host.`);
    }
  } catch {
    errors.push(`${name} must be a valid absolute URL.`);
  }
}

requireProductionHttps('NEXT_PUBLIC_SUPABASE_URL');
requireProductionHttps('PRODUCTION_BASE_URL');

if (process.env.NODE_ENV !== 'production') errors.push('NODE_ENV must equal production.');
if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') errors.push('NEXT_PUBLIC_DEMO_MODE must not be enabled in production.');
if (serverSecret && serverSecret === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
  errors.push('The server Supabase credential must differ from the public client credential.');
}
if (serverSecret && serverSecret.length < 20) errors.push('The server Supabase credential is implausibly short.');

if (errors.length > 0) {
  console.error(`Production environment check failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log('Production environment check passed. No secret values were printed.');
