import { test, expect } from '@playwright/test';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const password = 'E2E-Only-Strong-Password-2026!';
const minutesId = 'e2000000-0000-0000-0000-000000000301';

async function assertNonBlankPdf(bytes: Buffer) {
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  expect(document.numPages).toBeGreaterThanOrEqual(1);
  expect(document.numPages).toBeLessThanOrEqual(2);
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const pdfPage = await document.getPage(pageNumber);
    const text = await pdfPage.getTextContent();
    const joined = text.items.map((item) => 'str' in item ? item.str : '').join(' ').trim();
    expect(joined.length).toBeGreaterThan(40);
  }
}

test('final institutional committee minutes print clean RTL PDF without app chrome', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/البريد الإلكتروني|Email address/).fill('e2e.chair@example.test');
  await page.getByLabel(/كلمة المرور|Password/).fill(password);
  await page.getByRole('button', { name: /تسجيل الدخول|Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto(`/reports/minutes/${minutesId}`);
  await expect(page.getByRole('heading', { name: 'محضر اجتماع اللجنة العلمية المؤسسية' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText('APPROVED_FOR_SCFHS_SUBMISSION', { exact: true })).toBeVisible();

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.app-shell-header')).toBeHidden();
  await expect(page.locator('.app-shell-nav')).toBeHidden();
  const bytes = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  await assertNonBlankPdf(bytes);
});
