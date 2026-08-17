import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('keeps the investor demo on Pages and the full Next.js app on Workers', async () => {
  const [pagesSource, wranglerSource, openNextSource, nextSource, packageSource] = await Promise.all([
    read('cloudflare/pages.json'),
    read('wrangler.jsonc'),
    read('open-next.config.ts'),
    read('next.config.ts'),
    read('package.json'),
  ]);

  const pages = JSON.parse(pagesSource);
  const wrangler = JSON.parse(wranglerSource);
  const pkg = JSON.parse(packageSource);

  assert.equal(pages.output_directory, 'demo');
  assert.equal(pages.data_policy, 'synthetic-browser-local-only');
  assert.equal(wrangler.main, '.open-next/worker.js');
  assert.equal(wrangler.assets.directory, '.open-next/assets');
  assert.ok(wrangler.compatibility_flags.includes('nodejs_compat'));
  assert.match(openNextSource, /defineCloudflareConfig/);
  assert.match(nextSource, /images:\s*\{\s*unoptimized:\s*true/);
  assert.match(pkg.scripts['preview:cloudflare'], /opennextjs-cloudflare build/);
});

test('does not expose server-only Supabase credentials in Cloudflare config', async () => {
  const [pagesSource, wranglerSource] = await Promise.all([
    read('cloudflare/pages.json'),
    read('wrangler.jsonc'),
  ]);

  const publicConfig = `${pagesSource}\n${wranglerSource}`;
  assert.doesNotMatch(publicConfig, /SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY/);
  assert.doesNotMatch(publicConfig, /service_role/i);
});

test('uses Edge Middleware instead of unsupported Next.js Node Proxy', async () => {
  const middlewareSource = await read('src/middleware.ts');

  assert.match(middlewareSource, /export function middleware\(request:NextRequest\)/);
  assert.match(middlewareSource, /isRouteAllowedForRole/);
  await assert.rejects(read('src/proxy.ts'), { code: 'ENOENT' });
});
