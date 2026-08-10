import { test, expect } from '@playwright/test';

const email = 'e2e.admin.secretary@example.test';
const password = 'E2E-Only-Strong-Password-2026!';

test('one multi-role account keeps admin and secretary permissions separated by active role context', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/البريد الإلكتروني|Email address/).fill(email);
  await page.getByLabel(/كلمة المرور|Password/).fill(password);
  await page.getByRole('button', { name: /تسجيل الدخول|Sign in/ }).click();

  await expect(page).toHaveURL(/\/context/);
  await expect(page.getByRole('heading', { name: 'حدد المؤسسة والدور' })).toBeVisible();
  await page.getByRole('button', { name: /ORGANIZATION_SYSTEM_ADMIN/ }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('link', { name: /إدارة الأنشطة|Activity Administration/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /مساحة سكرتير اللجنة|Committee Secretary/ })).toHaveCount(0);

  const roleSelect = page.locator('select[name="role"]');
  await roleSelect.selectOption('COMMITTEE_SECRETARY');
  await page.getByRole('button', { name: /تبديل الدور|Switch role/ }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('link', { name: /مساحة سكرتير اللجنة|Committee Secretary/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /إدارة الأنشطة|Activity Administration/ })).toHaveCount(0);
});
