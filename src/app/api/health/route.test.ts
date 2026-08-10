import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('production health route', () => {
  it('returns only non-sensitive deterministic service health metadata', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');

    const body = await response.json();
    expect(body).toEqual({
      status: 'ok',
      service: 'cpd-governance-platform',
    });

    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toMatch(/key|secret|token|password|database|supabase|email|user/);
  });
});
