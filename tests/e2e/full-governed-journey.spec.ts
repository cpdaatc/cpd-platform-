import { test, expect, type Page } from '@playwright/test';

const password = 'E2E-Only-Strong-Password-2026!';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/البريد الإلكتروني|Email address/).fill(email);
  await page.getByLabel(/كلمة المرور|Password/).fill(password);
  await page.getByRole('button', { name: /تسجيل الدخول|Sign in/ }).click();
}

async function selectRole(page: Page, role: string) {
  await page.waitForURL(/\/(?:context|dashboard)(?:\?|$|\/)/, { timeout: 10000 });
  if (/\/context(?:\?|$|\/)/.test(page.url())) {
    await page.getByRole('button', { name: new RegExp(role) }).click();
  } else {
    const select = page.locator('#shell-role');
    if (await select.count()) {
      await select.selectOption(role);
      await page.getByRole('button', { name: /تبديل الدور|Switch role/ }).click();
    }
  }
  await expect(page).toHaveURL(/\/dashboard/);
}

test('activity officer can reach governed submission after confirmed intake and pre-review', async ({ page }) => {
  const title = `نشاط E2E للرحلة الحوكمية الكاملة ${Date.now()}-${test.info().retry}`;
  await login(page, 'e2e.admin.secretary@example.test');
  await selectRole(page, 'ORGANIZATION_SYSTEM_ADMIN');
  await page.getByRole('link', { name: 'إدارة الأنشطة', exact: true }).click();
  await page.getByRole('link', { name: 'إنشاء نشاط جديد' }).click();
  await page.getByLabel(/اسم النشاط بالعربية/).fill(title);
  await page.getByLabel(/اسم النشاط بالإنجليزية/).fill('Governed Journey E2E Activity');
  await page.getByLabel(/نوع النشاط/).fill('COURSE');
  await page.getByLabel(/طريقة التنفيذ/).fill('GROUP_INTERACTIVE');
  await page.getByLabel(/تاريخ البداية المخطط/).fill('2026-08-20');
  await page.getByLabel(/تاريخ النهاية المخطط/).fill('2026-08-20');
  await page.getByRole('button', { name: /إنشاء النشاط والمتابعة للإسناد/ }).click();
  await expect(page).toHaveURL(/\/admin\/activities\/.+\/assign/);
  const assignMatch = page.url().match(/\/admin\/activities\/([^/]+)\/assign/);
  expect(assignMatch).not.toBeNull();
  const activityId = assignMatch![1];
  await page.getByLabel(/مسؤول النشاط/).selectOption({ label: 'E2E Activity Officer' });
  await page.getByRole('button', { name: 'حفظ الإسناد' }).click();

  await page.getByRole('button', { name: /خروج|Sign out/ }).click();
  await login(page, 'e2e.officer@example.test');
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole('link', { name: 'أنشطتي', exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.goto(`/activities/${activityId}/intake`);

  await page.getByLabel(/التخصص/).fill('Medical Education');
  await page.getByLabel('العربية').check();
  await page.getByLabel(/الفئة المستهدفة/).fill('Healthcare professionals');
  await page.getByLabel(/Learning Need \/ Gap/).fill('Documented learning gap requiring measurable improvement.');
  await page.getByLabel(/Aim & Learning Outcomes/).fill('Improve governed CPD planning and evidence quality.');
  await page.getByLabel(/Learning Methods \/ Delivery Format/).fill('Interactive workshop and case discussion.');
  await page.getByLabel(/Participant \/ Activity Evaluation Method/).fill('Post-test and structured participant evaluation.');
  await page.getByLabel('Surveys').check();

  const objective = page.getByPlaceholder('Objective 1');
  await objective.fill('Apply the governed CPD workflow correctly by the end of the activity.');
  await objective.locator('..').locator('select').selectOption('SKILL');

  const committeeSection = page.getByRole('heading', { name: '4. اللجنة العلمية الخاصة بالنشاط' }).locator('xpath=ancestor::section[1]');
  await expect(committeeSection.getByPlaceholder('Full name *')).toHaveCount(2);
  await committeeSection.getByPlaceholder('Full name *').first().fill('Activity Committee Member One');
  await committeeSection.getByPlaceholder('Classification number').first().fill('SCFHS-E2E-001');
  await committeeSection.getByPlaceholder('Full name *').nth(1).fill('Activity Committee Member Two');
  await committeeSection.getByPlaceholder('Classification number').nth(1).fill('SCFHS-E2E-002');

  const speakers = page.getByRole('button', { name: 'حذف المتحدث' });
  if (await speakers.count()) await speakers.first().click();
  const sessions = page.getByRole('button', { name: 'حذف الجلسة' });
  if (await sessions.count()) await sessions.first().click();

  const payloadInput = page.locator('input[name="payload"]');
  await expect.poll(async () => {
    const raw = await payloadInput.inputValue();
    const payload = JSON.parse(raw);
    return {
      specialty: payload.profile?.specialty,
      targetAudience: payload.profile?.targetAudience,
      hasArabic: payload.profile?.activityLanguages?.includes('AR') ?? false,
      learningGap: payload.profile?.learningGap,
      objective: payload.objectives?.[0]?.objectiveText,
      secondCommitteeMember: payload.committeeMembers?.[1]?.fullName,
      speakers: payload.speakers?.length,
      sessions: payload.sessions?.length,
    };
  }).toEqual({
    specialty: 'Medical Education',
    targetAudience: 'Healthcare professionals',
    hasArabic: true,
    learningGap: 'Documented learning gap requiring measurable improvement.',
    objective: 'Apply the governed CPD workflow correctly by the end of the activity.',
    secondCommitteeMember: 'Activity Committee Member Two',
    speakers: 0,
    sessions: 0,
  });

  await page.getByRole('button', { name: 'تأكيد البيانات' }).click();
  await page.waitForURL(new RegExp(`/activities/${activityId}/intake(?:\\?confirmed=1)?`), { timeout: 10000 });
  const alertText = ((await page.getByRole('alert').first().textContent().catch(() => '')) ?? '').trim();
  if (alertText) throw new Error(`Intake confirmation failed: ${alertText}`);
  await expect(page).toHaveURL(new RegExp(`/activities/${activityId}/intake\\?confirmed=1`));

  await page.goto(`/activities/${activityId}/readiness`);
  await page.getByRole('button', { name: /تشغيل Pre.?Review/ }).click();
  await page.waitForURL(new RegExp(`/activities/${activityId}/readiness\\?(reviewed|error)=1`), { timeout: 10000 });
  if (page.url().includes('error=1')) throw new Error('Pre-review persistence failed in governed server action.');
  const latestReviewCard = page.getByText('آخر مراجعة').locator('..');
  await expect(latestReviewCard.getByText('Completed')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Latest Pre‑Review Findings' })).toBeVisible();

  const submitButton = page.getByRole('button', { name: 'إرسال إلى اللجنة المؤسسية' });
  await expect(submitButton).toBeVisible();
  await submitButton.click();
  await page.waitForURL(new RegExp(`/activities/${activityId}/readiness\\?(submitted|submitError)=1`), { timeout: 10000 });
  if (page.url().includes('submitError=1')) throw new Error('Governed immutable committee submission failed.');
  await expect(page.getByText(/تم تثبيت نسخة النشاط وإرسالها/)).toBeVisible();
});
