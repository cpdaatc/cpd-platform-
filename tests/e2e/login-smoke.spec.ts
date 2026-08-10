import { test, expect } from '@playwright/test';

test('login renders institutional identity and language control', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: /منصة التطوير المهني المستمر|Continuing Professional Development Platform/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /تسجيل الدخول|Sign in/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /English|العربية|AR|EN/ })).toBeVisible();
  await expect(page.locator('img').first()).toBeVisible();
});
