import { test, expect } from '@playwright/test';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const password = 'E2E-Only-Strong-Password-2026!';
const activityId = 'e2000000-0000-0000-0000-000000000101';
const reportId = 'e2000000-0000-0000-0000-000000000103';

test('final impact report is a two-page A4 print surface backed by structured data', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/البريد الإلكتروني|Email address/).fill('e2e.officer@example.test');
  await page.getByLabel(/كلمة المرور|Password/).fill(password);
  await page.getByRole('button', { name: /تسجيل الدخول|Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto(`/impact/${activityId}/report/${reportId}`);
  await expect(page.getByRole('heading', { name: 'تقرير قياس الأثر التدريبي' })).toBeVisible();
  await expect(page.getByText('96.7')).toBeVisible();
  await expect(page.locator('.report-page')).toHaveCount(2);

  await page.emulateMedia({ media: 'print' });
  const overflow = await page.locator('.report-page').evaluateAll((nodes) =>
    nodes.map((node) => ({ scrollHeight: node.scrollHeight, clientHeight: node.clientHeight })),
  );
  for (const pageBox of overflow) {
    expect(pageBox.scrollHeight).toBeLessThanOrEqual(pageBox.clientHeight + 4);
  }

  const bytes = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  expect(document.numPages).toBe(2);
});
