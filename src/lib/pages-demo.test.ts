import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('GitHub Pages full-platform demo', () => {
  it('publishes v3 with the full navigation and an intact official logo', async () => {
    const root = process.cwd();
    const [index, html, logo] = await Promise.all([
      readFile(join(root, 'demo', 'index.html'), 'utf8'),
      readFile(join(root, 'demo', 'v3.html'), 'utf8'),
      readFile(join(root, 'demo', 'logo.png')),
    ]);

    expect(index).toContain('./v3.html?release=20260811');
    expect(html).toContain("img.src='./logo.png?v=20260811'");
    expect([...logo.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const document = new DOMParser().parseFromString(html, 'text/html');
    const navPages = [...document.querySelectorAll<HTMLButtonElement>('.nav [data-page]')]
      .map((item) => item.dataset.page);
    const pageIds = [...document.querySelectorAll<HTMLElement>('section.page')]
      .map((item) => item.id);

    expect(navPages).toHaveLength(13);
    expect(pageIds).toHaveLength(13);
    expect(new Set(navPages)).toEqual(new Set(pageIds));
    expect(document.querySelectorAll('.dyn-logo').length).toBeGreaterThanOrEqual(4);
  });
});
