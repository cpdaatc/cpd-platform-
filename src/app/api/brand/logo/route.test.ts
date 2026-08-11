import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('brand logo route', () => {
  it('returns the complete official PNG asset instead of truncated placeholder data', async () => {
    const response = await GET();
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(bytes.length).toBeGreaterThan(10_000);
    expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });
});
