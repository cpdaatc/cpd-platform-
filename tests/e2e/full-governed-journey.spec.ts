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
  const contextHeading = page.getByRole('heading', { name: 'حدد المؤسسة والدور' });

  const stableDestination = await expect.poll(async () => {
    if (/\/dashboard(?:\?|$|\/)/.test(page.url())) return 'dashboard';
    if (/\/context(?:\?|$|\/)/.test(page.url()) && await contextHeading.isVisible().catch(() => false)) return 'context';
    return 'loading';
  }, { timeout: 10000 }).toMatch(/^(context|dashboard)$/).then(() =>
    /\/dashboard(?:\?|$|\/)/.test(page.url()) ? 'dashboard' : 'context',
  );

  if (stableDestination === 'context') {
    const requestedRoleInput = page.locator(`input[name="role"][value="${role}"]`);
    const organizationInput = page.locator('input[name="organizationId"]').first();
    await expect.poll(async () => (await requestedRoleInput.count()) + (await organizationInput.count()), { timeout: 10000 }).toBeGreaterThan(0);

    if (!(await requestedRoleInput.count()) && await organizationInput.count()) {
      await organizationInput.locator('xpath=ancestor::form[1]').getByRole('button').click();
      await expect(requestedRoleInput).toBeAttached({ timeout: 10000 });
    }

    await expect(requestedRoleInput).toBeAttached({ timeout: 10000 });
    await requestedRoleInput.locator('xpath=ancestor::form[1]').getByRole('button').click();
    await page.waitForURL(/\/dashboard(?:\?|$|\/)/, { timeout: 10000 });
  }

  await expect(page).toHaveURL(/\/dashboard/);
  const roleSelect = page.locator('select[name="role"]');
  await expect(roleSelect).toBeVisible();
  if ((await roleSelect.inputValue()) !== role) {
    await roleSelect.selectOption(role);
    await page.getByRole('button', { name: /تبديل الدور|Switch role/ }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  }
  await expect(roleSelect).toHaveValue(role);

  if (role === 'COMMITTEE_SECRETARY') {
    await expect(page.getByRole('link', { name: 'مساحة سكرتير اللجنة', exact: true })).toBeVisible();
  }
  if (role === 'ORGANIZATION_SYSTEM_ADMIN') {
    await expect(page.getByRole('link', { name: 'إدارة الأنشطة', exact: true }).first()).toBeVisible();
  }
}

async function logout(page: Page) {
  await page.getByRole('button', { name: /خروج|Sign out/ }).click();
  await expect(page).toHaveURL(/\/login/);
}

async function updateExternalStatus(page: Page, title: string, status: string, values: Record<string,string> = {}) {
  const activity = page.locator('article').filter({ hasText: title });
  await expect(activity).toBeVisible();
  const details = activity.locator('details');
  if (!(await details.getAttribute('open'))) await details.locator('summary').click();
  await details.locator('select[name="status"]').selectOption(status);
  for (const [name,value] of Object.entries(values)) await details.locator(`[name="${name}"]`).fill(value);
  await details.getByRole('button', { name: 'حفظ الحالة الخارجية' }).click();
  await expect(activity.getByText(status, { exact: true }).first()).toBeVisible();
}

test('full governed CPD journey reaches acknowledged annual report', async ({ page }) => {
  const suffix = `${Date.now()}-${test.info().retry}`;
  const title = `نشاط E2E للرحلة الحوكمية الكاملة ${suffix}`;
  const meetingReference = `E2E-GOV-${suffix}`;
  const requestNumber = `REQ-${suffix}`;
  const accreditationNumber = `ACC-${suffix}`;
  const policyVersion = `E2E-POL-${suffix}`;
  const methodologyVersion = `E2E-HTVI-${suffix}`;

  await login(page, 'e2e.admin.secretary@example.test');
  await selectRole(page, 'ORGANIZATION_SYSTEM_ADMIN');
  await page.getByRole('link', { name: 'إدارة الأنشطة', exact: true }).click();
  await page.getByRole('link', { name: 'إنشاء نشاط جديد' }).click();
  await page.getByLabel(/اسم النشاط بالعربية/).fill(title);
  await page.getByLabel(/اسم النشاط بالإنجليزية/).fill('Governed Journey E2E Activity');
  await page.getByLabel(/نوع النشاط/).fill('COURSE');
  await page.getByLabel(/طريقة التنفيذ/).fill('GROUP_INTERACTIVE');
  await page.getByLabel(/تاريخ البداية المخطط/).fill('2026-02-01');
  await page.getByLabel(/تاريخ النهاية المخطط/).fill('2026-02-01');
  await page.getByRole('button', { name: /إنشاء النشاط والمتابعة للإسناد/ }).click();
  await expect(page).toHaveURL(/\/admin\/activities\/.+\/assign/);
  const assignMatch = page.url().match(/\/admin\/activities\/([^/]+)\/assign/);
  expect(assignMatch).not.toBeNull();
  const activityId = assignMatch![1];
  await page.getByLabel(/مسؤول النشاط/).selectOption({ label: 'E2E Activity Officer' });
  await page.getByRole('button', { name: 'حفظ الإسناد' }).click();

  await logout(page);
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
  await expect(page).toHaveURL(new RegExp(`/activities/${activityId}/intake\\?confirmed=1`));

  await page.goto(`/activities/${activityId}/readiness`);
  await page.getByRole('button', { name: /تشغيل Pre.?Review/ }).click();
  await page.waitForURL(new RegExp(`/activities/${activityId}/readiness\\?(reviewed|error)=1`), { timeout: 10000 });
  if (page.url().includes('error=1')) throw new Error('Pre-review persistence failed in governed server action.');
  await expect(page.getByText('آخر مراجعة').locator('..').getByText('Completed')).toBeVisible();

  const submitButton = page.getByRole('button', { name: 'إرسال إلى اللجنة المؤسسية' });
  await expect(submitButton).toBeEnabled();
  await submitButton.click();
  await page.waitForURL(new RegExp(`/activities/${activityId}/readiness\\?(submitted|submitError)=1`), { timeout: 10000 });
  if (page.url().includes('submitError=1')) throw new Error('Governed immutable committee submission failed.');

  await logout(page);
  await login(page, 'e2e.admin.secretary@example.test');
  await selectRole(page, 'COMMITTEE_SECRETARY');
  await page.goto('/committee/secretary');
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.getByLabel('مرجع الاجتماع').fill(meetingReference);
  await page.getByLabel('التاريخ والوقت').fill('2026-02-05T10:00');
  await page.getByLabel('المكان / القناة').fill('E2E Governance Room');
  await page.getByRole('button', { name: 'إنشاء الاجتماع' }).click();
  await page.getByRole('button', { name: 'حفظ الحضور' }).click();

  const activityReviewForm = page.locator('form').filter({ hasText: title });
  await activityReviewForm.getByLabel('إسناد إلى اجتماع').selectOption({ label: meetingReference });
  await activityReviewForm.getByRole('button', { name: 'فتح المراجعة' }).click();
  await expect(page).toHaveURL(/\/committee\/reviews\/[0-9a-f-]+$/i);
  const reviewId = page.url().split('/').pop()!;
  await page.getByRole('button', { name: 'حفظ التقييم الجماعي' }).click();
  await expect(page).toHaveURL(new RegExp(`/committee/reviews/${reviewId}\\?assessmentSaved=1`));

  await logout(page);
  await login(page, 'e2e.chair@example.test');
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto(`/committee/reviews/${reviewId}`);
  await page.locator('select[name="decision"]').selectOption('APPROVED_FOR_SCFHS_SUBMISSION');
  await page.getByPlaceholder('ملاحظات القرار').fill('E2E chair approval for external submission readiness.');
  await page.getByRole('button', { name: 'تسجيل قرار رئيس اللجنة' }).click();
  await expect(page).toHaveURL(new RegExp(`/committee/reviews/${reviewId}\\?decided=1`));

  await logout(page);
  await login(page, 'e2e.admin.secretary@example.test');
  await selectRole(page, 'COMMITTEE_SECRETARY');
  await page.goto(`/committee/reviews/${reviewId}`);
  await page.getByRole('button', { name: 'إعداد مسودة المحضر' }).click();
  await expect(page).toHaveURL(new RegExp(`/committee/reviews/${reviewId}\\?minutesDrafted=1`));

  await logout(page);
  await login(page, 'e2e.chair@example.test');
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto(`/committee/reviews/${reviewId}`);
  await page.getByRole('button', { name: 'اعتماد المحضر النهائي' }).click();
  await expect(page).toHaveURL(new RegExp(`/committee/reviews/${reviewId}\\?minutesFinal=1`));

  await logout(page);
  await login(page, 'e2e.admin.secretary@example.test');
  await selectRole(page, 'ORGANIZATION_SYSTEM_ADMIN');
  await page.goto('/external');
  const trackedActivity = page.locator('article').filter({ hasText: title });
  await expect(trackedActivity.getByText('Internal: READY_FOR_SCFHS_SUBMISSION', { exact: true })).toBeVisible();
  await updateExternalStatus(page, title, 'READY_FOR_SCFHS_SUBMISSION');
  await updateExternalStatus(page, title, 'SUBMITTED', { requestNumber, submissionDate: '2026-02-06', serviceType: 'CPD_ACTIVITY' });
  await updateExternalStatus(page, title, 'APPROVED', { requestNumber, accreditationNumber, approvedHours: '6', decisionDate: '2026-02-07', evidenceReference: `e2e/scfhs/${accreditationNumber}.pdf` });
  await expect(trackedActivity.getByText('Internal: EXTERNAL_TRACKING', { exact: true })).toBeVisible();

  await page.goto('/impact');
  const settings = page.locator('details').filter({ hasText: 'إعداد نسخة جديدة من سياسة المتابعة والمنهجية' });
  await settings.locator('summary').click();
  const policyForm = settings.locator('form').filter({ hasText: 'سياسة المتابعة' });
  await policyForm.locator('input[name="version"]').fill(policyVersion);
  await policyForm.locator('input[name="effectiveFrom"]').fill('2026-01-01');
  for (const level of ['L1','L2','L3','L4']) {
    await policyForm.locator(`input[name="${level}Due"]`).fill(level === 'L3' ? '30' : level === 'L4' ? '90' : '0');
    await policyForm.locator(`input[name="${level}Grace"]`).fill('0');
  }
  await policyForm.getByRole('button', { name: 'حفظ Draft Policy' }).click();
  await expect(page.getByText(`Policy ${policyVersion}`, { exact: false })).toBeVisible();

  const methodSettings = page.locator('details').filter({ hasText: 'إعداد نسخة جديدة من سياسة المتابعة والمنهجية' });
  if (!(await methodSettings.getAttribute('open'))) await methodSettings.locator('summary').click();
  const methodForm = methodSettings.locator('form').filter({ hasText: 'منهجية HTVI' });
  await methodForm.locator('input[name="version"]').fill(methodologyVersion);
  await methodForm.getByRole('button', { name: 'حفظ Draft Methodology' }).click();

  await logout(page);
  await login(page, 'e2e.management@example.test');
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/impact');
  await page.getByRole('button', { name: new RegExp(`اعتماد Policy ${policyVersion}`) }).click();
  await expect(page.getByText(policyVersion, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`اعتماد HTVI ${methodologyVersion}`) }).click();
  await expect(page.getByText(`HTVI ${methodologyVersion}`, { exact: true })).toBeVisible();

  await logout(page);
  await login(page, 'e2e.admin.secretary@example.test');
  await selectRole(page, 'ORGANIZATION_SYSTEM_ADMIN');
  await page.goto('/impact');
  const impactActivity = page.locator('article').filter({ hasText: title });
  await impactActivity.locator('input[name="conductedAt"]').fill('2026-02-10T10:00');
  await impactActivity.getByRole('button', { name: 'تأكيد تنفيذ النشاط' }).click();
  await expect(impactActivity.getByText('Internal: IMPACT_FOLLOWUP', { exact: false })).toBeVisible();
  await impactActivity.getByRole('link', { name: 'فتح قياس الأثر' }).click();
  await expect(page).toHaveURL(new RegExp(`/impact/${activityId}$`));

  const l1Form = page.locator('form').filter({ hasText: 'L1 — Reaction' });
  for (const name of ['content','objectives','trainer','organization','applicability','overall']) await l1Form.locator(`input[name="${name}"]`).fill('4.4');
  await l1Form.getByRole('button', { name: 'حفظ L1' }).click();
  await expect(page.getByText('88.0', { exact: true })).toBeVisible();

  const l2Form = page.locator('form').filter({ hasText: 'L2 — Learning' });
  await l2Form.locator('input[name="post"]').fill('100');
  await l2Form.locator('input[name="target"]').fill('100');
  await l2Form.getByRole('button', { name: 'حفظ L2' }).click();
  await page.getByRole('button', { name: 'Interim', exact: true }).click();
  await expect(page.getByText(/INTERIM v1.*PENDING/)).toBeVisible();

  const l3Form = page.locator('form').filter({ hasText: 'L3 — Behavior' });
  await l3Form.locator('input[name="applicationRate"]').fill('100');
  await l3Form.locator('input[name="target"]').fill('100');
  await l3Form.getByRole('button', { name: 'حفظ L3' }).click();

  const l4Form = page.locator('form').filter({ hasText: 'هدف أثر 1' });
  await l4Form.getByLabel('الهدف').fill('تحسين تطبيق الحوكمة بعد النشاط');
  await l4Form.getByLabel('المؤشر').fill('نسبة التطبيق');
  await l4Form.getByLabel('خط الأساس').fill('62');
  await l4Form.getByLabel('المستهدف').fill('100');
  await l4Form.getByLabel('بعد النشاط').fill('95.907');
  await l4Form.getByLabel('مصدر البيانات').fill('Synthetic governed follow-up');
  await l4Form.getByRole('button', { name: 'حفظ L4 وحساب النتيجة' }).click();
  const finalButton = page.getByRole('button', { name: 'Final', exact: true });
  await expect(finalButton).toBeEnabled();
  await finalButton.click();
  await expect(page.getByText('FINAL HTVI', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'عرض / طباعة التقرير' })).toBeVisible();

  await logout(page);
  await login(page, 'e2e.admin.secretary@example.test');
  await selectRole(page, 'COMMITTEE_SECRETARY');
  await page.goto('/annual-reports');
  await page.locator('input[name="year"]').fill('2026');
  await page.getByRole('button', { name: 'توليد / تحديث مسودة التقرير' }).click();
  const annual = page.locator('article').filter({ hasText: '2026' }).first();
  await expect(annual.getByText('CHAIR_REVIEW', { exact: true })).toBeVisible();
  await expect(annual.getByText('Coverage denominator').locator('..')).toContainText(/[1-9]/);

  await logout(page);
  await login(page, 'e2e.chair@example.test');
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/annual-reports');
  await page.getByRole('button', { name: 'اعتماد رئيس اللجنة' }).click();
  await expect(page.getByText('SUBMITTED_TO_MANAGEMENT', { exact: true })).toBeVisible();

  await logout(page);
  await login(page, 'e2e.management@example.test');
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/annual-reports');
  const managementAnnual = page.locator('article').filter({ hasText: '2026' }).first();
  await managementAnnual.getByPlaceholder('تعليق إداري اختياري').fill('E2E management acknowledgement only.');
  await managementAnnual.getByRole('button', { name: 'إقرار الاستلام' }).click();
  await expect(managementAnnual.getByText('ACKNOWLEDGED', { exact: true })).toBeVisible();
});
