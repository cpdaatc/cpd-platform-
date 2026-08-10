import { test, expect } from '@playwright/test';

test('public responses expose hardened browser security headers', async ({ request }) => {
  const response = await request.get('/login');
  expect(response.ok()).toBe(true);
  const headers = response.headers();

  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');

  const csp = headers['content-security-policy'] ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'self'");
  expect(csp).toContain("form-action 'self'");

  // Playwright uses the local development server; HSTS is production-only.
  expect(headers['strict-transport-security']).toBeUndefined();
});
