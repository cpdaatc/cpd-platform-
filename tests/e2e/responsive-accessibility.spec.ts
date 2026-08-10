import { test, expect } from '@playwright/test';

test('Arabic login remains usable on a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');

  await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByLabel('البريد الإلكتروني')).toBeVisible();
  await expect(page.getByLabel('كلمة المرور')).toBeVisible();
  await expect(page.getByRole('button', { name: 'تسجيل الدخول' })).toBeVisible();
  await expect(page.locator('body')).not.toHaveJSProperty('scrollWidth', 0);
});

test('login primary controls are reachable and operable with keyboard focus', async ({ page }) => {
  await page.goto('/login');
  const email = page.getByLabel(/البريد الإلكتروني|Email address/);
  const password = page.getByLabel(/كلمة المرور|Password/);
  const submit = page.getByRole('button', { name: /تسجيل الدخول|Sign in/ });

  await email.focus();
  await expect(email).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(password).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(submit).toBeFocused();
});
