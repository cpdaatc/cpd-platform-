import { expect, test } from '@playwright/test';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const roleCodes = [
  'PLATFORM_SUPER_ADMIN',
  'ORGANIZATION_SYSTEM_ADMIN',
  'ACTIVITY_OFFICER',
  'COMMITTEE_SECRETARY',
  'COMMITTEE_CHAIR',
  'COMMITTEE_MEMBER',
  'MANAGEMENT_VIEWER',
  'MANAGEMENT_APPROVER',
  'AUDITOR',
];

async function signIn(page: import('@playwright/test').Page, role = 'ORGANIZATION_SYSTEM_ADMIN') {
  await page.locator('#role').selectOption(role);
  await page.getByRole('button', { name: 'دخول مساحة العمل' }).click();
  await expect(page.locator('#app')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/v4\.html\?release=20260818-1/);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('administrator creates an activity, uploads PDF, validates readiness, prints, and recalculates HTVI', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'المشهد التشغيلي اليوم' })).toBeVisible();
  await expect(page.locator('#workQueueTable tbody tr')).toHaveCount(3);

  await page.getByRole('button', { name: 'إدارة الأنشطة' }).click();
  await page.getByRole('button', { name: 'إنشاء نشاط جديد' }).click();
  await expect(page.locator('#activityDialog')).toBeVisible();
  await page.locator('#newTitleAr').fill('ورشة مكافحة العدوى المبنية على المحاكاة');
  await page.locator('#newTitleEn').fill('Simulation-based Infection Control Workshop');
  await page.locator('#newAudience').fill('التمريض وممارسو مكافحة العدوى');
  await page.locator('#newBriefPdf').setInputFiles({
    name: 'activity-brief.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% demo'),
  });
  await page.getByRole('button', { name: 'إنشاء وإسناد النشاط' }).click();
  await expect(page.locator('#activityAdminTable tbody')).toContainText('ورشة مكافحة العدوى المبنية على المحاكاة');
  await expect(page.locator('#toast')).toContainText('تم إنشاء HT-2026-004');

  await page.getByRole('button', { name: 'الأنشطة ومساحة العمل' }).click();
  await page.locator('#activityPdf').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a PDF'),
  });
  await expect(page.locator('#activityPdfStatus')).toContainText('غير مقبول');
  await expect(page.locator('#readinessScore')).toHaveText('8 / 9');
  await page.locator('#activityPdf').setInputFiles({
    name: 'completed-activity-form.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% completed demo form'),
  });
  await expect(page.locator('#activityPdfStatus')).toContainText('completed-activity-form.pdf');
  await page.locator('#checkReadiness').click();
  await expect(page.locator('#readinessScore')).toHaveText('9 / 9');
  await expect(page.locator('#readinessMessage')).toContainText('جاهز للإرسال');

  await page.evaluate(() => { window.print = () => undefined; });
  await page.locator('#printActivity').click();
  await expect(page.locator('#officialFormDialog')).toBeVisible();
  await expect(page.locator('#officialFormDialog .official-form-preview img')).toHaveCount(6);
  await page.locator('#officialFormDialog [data-close-dialog]').click();

  await page.getByRole('button', { name: 'قياس الأثر وHTVI' }).click();
  await page.locator('#l1Score').fill('90');
  await expect(page.locator('#htviScore')).toHaveText('96.9');
  await page.locator('#saveImpact').click();
  await expect(page.locator('#toast')).toContainText('HTVI الحالي: 96.9');
});

test('all nine roles can traverse every visible workspace and read-only roles cannot mutate', async ({ page }) => {
  for (const role of roleCodes) {
    await signIn(page, role);
    const visibleNav = page.locator('.nav [data-page]:visible');
    const count = await visibleNav.count();
    expect(count).toBeGreaterThan(0);

    const pageIds = await visibleNav.evaluateAll((buttons) => buttons.map((button) => (button as HTMLElement).dataset.page || ''));
    for (const pageId of pageIds) {
      await page.locator(`.nav [data-page="${pageId}"]`).click();
      await expect(page.locator(`#${pageId}.page`)).toBeVisible();
      await expect(page.locator(`#${pageId}`).locator('table, form').first()).toBeAttached();
    }

    if (role === 'AUDITOR' || role === 'MANAGEMENT_VIEWER') {
      await expect(page.locator('[data-mutate]:not(:disabled)')).toHaveCount(0);
    }
    await page.locator('#logout').click();
    await expect(page.locator('#login')).toBeVisible();
  }
});

test('auditor sees a real immutable event register and cannot reach administration', async ({ page }) => {
  await signIn(page, 'AUDITOR');
  await expect(page.locator('.nav [data-page="admin"]')).toBeHidden();
  await page.getByRole('button', { name: 'التدقيق والحوكمة' }).click();
  await expect(page.locator('#auditTable tbody tr')).toHaveCount(5);
  await expect(page.locator('#auditTable')).toContainText('IMPACT_FINALIZED');
  await expect(page.locator('#auditTable')).toContainText('ROLE_CONTEXT_SET');
});

test('governed role actions update committee, external, evidence, notification, and template registers', async ({ page }) => {
  await signIn(page, 'COMMITTEE_SECRETARY');
  await page.getByRole('button', { name: 'اللجنة والقرارات' }).click();
  await page.locator('#recordCommitteeReview').click();
  await expect(page.locator('#committeeReviewStatus')).toContainText('PARTIAL · مثبت');
  await page.locator('#logout').click();

  await signIn(page, 'COMMITTEE_CHAIR');
  await page.getByRole('button', { name: 'اللجنة والقرارات' }).click();
  await page.locator('#chairDecisionForm button[type="submit"]').click();
  await expect(page.locator('#chairDecisionStatus')).toContainText('APPROVED FOR SCFHS SUBMISSION');
  await page.locator('#logout').click();

  await signIn(page, 'ACTIVITY_OFFICER');
  await page.getByRole('button', { name: 'التتبع الخارجي' }).click();
  await page.locator('#externalStatus').selectOption({ label: 'UNDER SCFHS REVIEW' });
  await page.locator('#externalTrackingForm button[type="submit"]').click();
  await expect(page.locator('#externalHistoryTable tbody tr')).toHaveCount(4);
  await page.getByRole('button', { name: 'جاهزية الأدلة' }).click();
  await page.locator('[data-missing-evidence]').setInputFiles({
    name: 'speaker-disclosures.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% disclosures'),
  });
  await expect(page.locator('#evidenceSummary')).toHaveText('9 / 9 مرفوع');
  await page.getByRole('button', { name: 'الإشعارات' }).click();
  await page.locator('#markAllRead').click();
  await expect(page.locator('#notificationsTable [data-unread="true"]')).toHaveCount(0);
  await page.locator('#logout').click();

  await signIn(page, 'MANAGEMENT_APPROVER');
  await page.getByRole('button', { name: 'القوالب والمراجع' }).click();
  await page.locator('#openTemplateDialog').click();
  await page.locator('#templateFile').setInputFiles({
    name: 'activity-template-v3.3.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% template'),
  });
  await page.locator('#templateUploadForm button[type="submit"]').click();
  await expect(page.locator('#templatesTable tbody tr').first()).toContainText('3.3');
  await expect(page.locator('#templatesTable tbody tr').first()).toContainText('DRAFT');
});

test('final impact report produces exactly two non-overflowing A4 PDF pages', async ({ page }) => {
  await signIn(page, 'COMMITTEE_CHAIR');
  await page.getByRole('button', { name: 'التقارير والطباعة' }).click();
  await page.locator('#impactReport').evaluate((target) => target.classList.add('print-target'));
  await page.emulateMedia({ media: 'print' });

  const overflow = await page.locator('#impactReport > .paper').evaluateAll((pages) =>
    pages.map((paper) => ({ scrollHeight: paper.scrollHeight, clientHeight: paper.clientHeight })),
  );
  expect(overflow).toHaveLength(2);
  for (const paper of overflow) expect(paper.scrollHeight).toBeLessThanOrEqual(paper.clientHeight + 4);

  const bytes = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  expect(document.numPages).toBe(2);
});

test('mobile workspace keeps forms readable without page-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, 'ACTIVITY_OFFICER');
  await page.getByRole('button', { name: 'الأنشطة ومساحة العمل' }).click();
  await expect(page.locator('#activityIntakeForm')).toBeVisible();
  await expect(page.locator('#activityTitle')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('dossier registry filters with AND semantics and Activity Officer sees only assignments', async ({ page }) => {
  await signIn(page, 'ORGANIZATION_SYSTEM_ADMIN');
  await page.getByRole('button', { name: 'سجل ملفات الأنشطة' }).click();
  await expect(page.locator('#dossierRegistryTable tbody tr')).toHaveCount(3);
  await page.locator('#dossierYear').selectOption('2026');
  await page.locator('#dossierDepartment').selectOption('quality');
  await page.locator('#dossierSearch').fill('patient safety');
  await expect(page.locator('#dossierRegistryTable tbody tr')).toHaveCount(1);
  await expect(page.locator('#dossierRegistryTable')).toContainText('HT-2026-002');
  await page.locator('#logout').click();

  await signIn(page, 'ACTIVITY_OFFICER');
  await page.getByRole('button', { name: 'سجل ملفات الأنشطة' }).click();
  await expect(page.locator('#dossierRegistryTable tbody tr')).toHaveCount(2);
  await expect(page.locator('#dossierRegistryTable')).not.toContainText('HT-2026-002');
  await page.locator('#dossierRegistryTable tbody tr').first().getByRole('button', { name: 'فتح الملف' }).click();
  await expect(page.locator('#demoDossier')).toContainText('قرار اللجنة');
  await expect(page.locator('#demoDossier')).toContainText('تقرير الأثر النهائي');
});

test('official uploaded form preview preserves six Letter source pages', async ({ page }) => {
  await signIn(page, 'ACTIVITY_OFFICER');
  await page.getByRole('button', { name: 'سجل ملفات الأنشطة' }).click();
  await page.locator('#dossierRegistryTable tbody tr').first().getByRole('button', { name: 'فتح الملف' }).click();
  await page.getByRole('button', { name: 'معاينة النموذج الرسمي 6 صفحات' }).click();
  await expect(page.locator('#officialFormDialog .official-form-preview img')).toHaveCount(6);
  await expect(page.locator('#officialFormPrint img')).toHaveCount(6);
});
