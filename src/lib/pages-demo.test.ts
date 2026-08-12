import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('GitHub Pages full-platform demo', () => {
  it('publishes the operational demo with full navigation and an intact official logo', async () => {
    const root = process.cwd();
    const [index, html, script, stylesheet, logo] = await Promise.all([
      readFile(join(root, 'demo', 'index.html'), 'utf8'),
      readFile(join(root, 'demo', 'v4.html'), 'utf8'),
      readFile(join(root, 'demo', 'operational.js'), 'utf8'),
      readFile(join(root, 'demo', 'operational.css'), 'utf8'),
      readFile(join(root, 'demo', 'logo.png')),
    ]);

    expect(index).toContain('./v4.html?release=20260812-1');
    expect(html).toContain('./logo.png?v=20260812-1');
    expect(html).toContain('./operational.js?v=20260812-1');
    expect(html).toContain('./operational.css?v=20260812-1');
    for (const role of ['PLATFORM_SUPER_ADMIN','ORGANIZATION_SYSTEM_ADMIN','ACTIVITY_OFFICER','COMMITTEE_SECRETARY','COMMITTEE_CHAIR','COMMITTEE_MEMBER','MANAGEMENT_VIEWER','MANAGEMENT_APPROVER','AUDITOR']) {
      expect(html).toContain(`value="${role}"`);
      expect(script).toContain(`${role}: {`);
    }
    expect(script).toContain('button.hidden = !role.pages.includes(button.dataset.page)');
    expect(script).toContain('checkActivityReadiness');
    expect(script).toContain('calculateHtvi');
    expect(script).toContain('printSheet');
    expect(stylesheet).toContain('@page { size: A4; margin: 0; }');
    expect([...logo.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const document = new DOMParser().parseFromString(html, 'text/html');
    const navPages = [...document.querySelectorAll<HTMLButtonElement>('.nav [data-page]')]
      .map((item) => item.dataset.page);
    const pageIds = [...document.querySelectorAll<HTMLElement>('section.page')]
      .map((item) => item.id);
    const elementIds = [...document.querySelectorAll<HTMLElement>('[id]')]
      .map((item) => item.id);

    expect(navPages).toHaveLength(13);
    expect(pageIds).toHaveLength(13);
    expect(new Set(navPages)).toEqual(new Set(pageIds));
    expect(new Set(elementIds).size).toBe(elementIds.length);
    expect(document.querySelectorAll('.logo-img').length).toBeGreaterThanOrEqual(6);

    const annual = document.querySelector('#annual')?.textContent ?? '';
    expect(annual).toContain('إجمالي الأنشطة');
    expect(annual).toContain('التقارير النهائية');
    expect(annual).toContain('33.3% تغطية');
    expect(annual).not.toContain('الأنشطة المكتملة');
  });

  it('rejects a headings-only demo by requiring operational controls in every section', async () => {
    const html = await readFile(join(process.cwd(), 'demo', 'v4.html'), 'utf8');
    const document = new DOMParser().parseFromString(html, 'text/html');
    const pages = [...document.querySelectorAll<HTMLElement>('section.page')];

    expect(pages).toHaveLength(13);
    for (const page of pages) {
      expect(page.querySelector('table, form'), `${page.id} must expose a real table or form`).not.toBeNull();
    }

    for (const formId of ['activityCreateForm', 'activityIntakeForm', 'assessmentPlanForm', 'committeeReviewForm', 'externalTrackingForm', 'impactForm', 'annualFilterForm', 'templateUploadForm', 'auditFilterForm']) {
      expect(document.querySelector(`#${formId}`), `${formId} must be present`).not.toBeNull();
    }

    expect(document.querySelectorAll('table').length).toBeGreaterThanOrEqual(20);
    expect(document.querySelectorAll('input').length).toBeGreaterThanOrEqual(45);
    expect(document.querySelectorAll('select').length).toBeGreaterThanOrEqual(20);
    expect(document.querySelectorAll('textarea').length).toBeGreaterThanOrEqual(8);
    expect(document.querySelectorAll('input[type="file"][accept*="application/pdf"]').length).toBeGreaterThanOrEqual(12);
    expect(document.querySelectorAll('dialog')).toHaveLength(2);
    expect(document.querySelectorAll('[data-mutate], [data-roles]').length).toBeGreaterThanOrEqual(20);
    expect(document.querySelectorAll('#impactReport > .paper')).toHaveLength(2);
    expect(document.querySelector('#reportsRegisterTable')?.textContent).toContain('2 A4');
  });
});
