import { test, expect } from '@playwright/test';

const password = 'E2E-Only-Strong-Password-2026!';
const title = 'نشاط E2E لجاهزية الإنتاج';

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/البريد الإلكتروني|Email address/).fill(email);
  await page.getByLabel(/كلمة المرور|Password/).fill(password);
  await page.getByRole('button', { name: /تسجيل الدخول|Sign in/ }).click();
}

test('admin creates and assigns an activity, then the assigned officer sees it in My Activities', async ({ page }) => {
  await login(page, 'e2e.admin.secretary@example.test');
  await expect(page).toHaveURL(/\/context/);
  await page.getByRole('button', { name: /ORGANIZATION_SYSTEM_ADMIN/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole('link', { name: 'إدارة الأنشطة', exact: true }).click();
  await page.getByRole('link', { name: 'إنشاء نشاط جديد' }).click();
  await page.getByLabel(/اسم النشاط بالعربية/).fill(title);
  await page.getByLabel(/اسم النشاط بالإنجليزية/).fill('Production Readiness E2E Activity');
  await page.getByLabel(/نوع النشاط/).fill('COURSE');
  await page.getByLabel(/طريقة التنفيذ/).fill('GROUP_INTERACTIVE');
  await page.getByLabel(/تاريخ البداية المخطط/).fill('2026-09-01');
  await page.getByLabel(/تاريخ النهاية المخطط/).fill('2026-09-01');
  await page.getByRole('button', { name: /إنشاء النشاط والمتابعة للإسناد/ }).click();

  await expect(page).toHaveURL(/\/admin\/activities\/.+\/assign/);
  await page.getByLabel(/مسؤول النشاط/).selectOption({ label: 'E2E Activity Officer' });
  await page.getByRole('button', { name: 'حفظ الإسناد' }).click();
  await expect(page).toHaveURL(/\/admin\?assigned=1/);
  await expect(page.getByText(title)).toBeVisible();

  await page.getByRole('button', { name: /خروج|Sign out/ }).click();
  await login(page, 'e2e.officer@example.test');
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole('link', { name: 'أنشطتي', exact: true }).click();
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByRole('link', { name: /فتح ملف النشاط/ })).toBeVisible();
});
