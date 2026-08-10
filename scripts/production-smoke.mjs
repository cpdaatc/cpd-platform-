const baseUrlText = process.env.PRODUCTION_BASE_URL?.trim();
if (!baseUrlText) throw new Error('PRODUCTION_BASE_URL is required.');

const baseUrl = new URL(baseUrlText);
if (baseUrl.protocol !== 'https:' || ['localhost', '127.0.0.1', 'example.com'].includes(baseUrl.hostname)) {
  throw new Error('PRODUCTION_BASE_URL must be a non-placeholder HTTPS URL.');
}

async function fetchWithTimeout(path) {
  return fetch(new URL(path, baseUrl), {
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
    headers: { 'User-Agent': 'cpd-production-smoke/1.0' },
  });
}

const health = await fetchWithTimeout('/api/health');
if (health.status !== 200) throw new Error(`Health endpoint returned HTTP ${health.status}.`);
const healthBody = await health.json();
if (healthBody?.status !== 'ok' || healthBody?.service !== 'cpd-governance-platform') {
  throw new Error('Health endpoint returned an unexpected contract.');
}
if (!health.headers.get('cache-control')?.includes('no-store')) {
  throw new Error('Health endpoint is missing its no-store cache boundary.');
}

const login = await fetchWithTimeout('/login');
if (login.status !== 200) throw new Error(`Login page returned HTTP ${login.status}.`);
const loginBody = await login.text();
if (!loginBody.includes('تسجيل الدخول') && !loginBody.toLowerCase().includes('sign in')) {
  throw new Error('Login page identity marker was not found.');
}

console.log('Production smoke passed: health contract and login surface are reachable.');
