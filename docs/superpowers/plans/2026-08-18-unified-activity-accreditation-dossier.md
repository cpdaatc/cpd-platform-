# Unified Activity Accreditation Dossier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one governed activity dashboard and dossier across the full Supabase-backed platform and the synthetic Cloudflare Pages demonstration, with role-scoped access, unified reports/documents, exact official-form printing, and deterministic report output.

**Architecture:** A versioned TypeScript dossier contract defines the shared UI/read model. The full platform composes it from existing Supabase records behind RLS and server-authorized document access; the static demonstration uses synthetic fixtures that satisfy the same contract. Existing activity, evidence, minutes, decision, impact, annual-report, and audit tables remain authoritative.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase PostgreSQL/Auth/Storage/RLS, Zod, Vitest, Playwright, static HTML/CSS/JavaScript for Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-08-18-unified-activity-accreditation-dossier-design.md`

## Global Constraints

- The uploaded `SCHS Form (1) 2(2).docx` is the sole visual/content source for the official activity application.
- Official application output is six US Letter pages (8.5 × 11 inches) with unchanged page order, labels, tables, colors, controls, and layout.
- `CPD Basic Capsules 102 مصادر تعليمية 2(2).pdf` is guidance only; do not copy its text or infer missing values.
- Final impact report remains exactly two A4 pages.
- Missing full-platform values remain blank; only the public demo uses visibly labelled synthetic values.
- Internal committee approval means readiness for SCFHS submission, never SCFHS accreditation.
- Activity Officer sees only actively assigned activities and cannot finalize committee decisions or minutes.
- Supabase RLS/server authorization is the security boundary; client-side filtering is not authorization.
- Finalized governed documents are immutable; corrections create controlled versions.
- No unrelated role, workflow, branding, or data-model expansion.

---

## File structure

### Shared contract and logic

- Create `src/features/activity-dossier/contract.ts`: dossier types, Zod schemas, role visibility helpers, readiness derivation.
- Create `src/features/activity-dossier/contract.test.ts`: contract, role matrix, filter and readiness unit tests.
- Create `src/features/activity-dossier/queries.ts`: full-platform activity list and dossier composition.
- Create `src/features/activity-dossier/queries.test.ts`: query mapping tests with a repository seam.
- Create `demo/activity-dossiers.synthetic.js`: static synthetic fixtures matching contract v1.
- Create `tests/contracts/activity-dossier-demo.test.ts`: parity assertions for static fixtures.

### Database and authorization

- Create `supabase/migrations/20260818120000_activity_dossier.sql`: permission-safe activity dossier helpers, evidence version metadata, authorized download resolver, indexes, function ACLs.
- Create `tests/sql/phase_15_activity_dossier.sql`: tenant, role, assignment, document and readiness acceptance tests.

### Full-platform UI

- Modify `src/app/(app)/activities/page.tsx`: server page shell and data load.
- Create `src/features/activity-dossier/activity-dashboard.tsx`: client filters/search and results table.
- Create `src/app/(app)/activities/[id]/dossier/page.tsx`: unified dossier screen.
- Create `src/features/activity-dossier/dossier-sections.tsx`: focused overview/document/readiness/audit sections.
- Create `src/app/api/activities/[id]/documents/[documentId]/route.ts`: authorized download redirect.
- Modify `src/app/(app)/activities/[id]/intake/file-actions.ts`: redirect uploads back to dossier when requested and preserve previous valid version on failure.
- Modify `src/components/app-shell.tsx`: route label remains role-appropriate without broadening permissions.

### Official form and print surfaces

- Create `public/templates/schs-activity-application-v1/page-1.svg` through `page-6.svg`: source-derived immutable page artwork.
- Create matching `demo/templates/schs-activity-application-v1/page-1.svg` through `page-6.svg` and enforce identical hashes.
- Create `src/features/official-form/field-map.ts`: fixed six-page field coordinates and overflow constraints.
- Create `src/features/official-form/field-map.test.ts`: source-field coverage and bounds tests.
- Create `src/features/official-form/official-form-print.tsx`: six-page Letter overlay renderer.
- Create `src/app/(app)/activities/[id]/official-form/page.tsx`: authenticated form preview/print route.
- Modify `src/app/globals.css`: isolated Letter and deterministic A4 print rules.

### Report and demo hardening

- Modify `src/app/(app)/reports/minutes/[id]/page.tsx`: deterministic A4 page container and dossier return link.
- Modify `src/app/(app)/annual-reports/[id]/page.tsx`: deterministic A4 print surface.
- Modify `src/app/(app)/impact/[id]/report/[reportId]/page.tsx`: dossier return link while retaining exactly two A4 pages.
- Modify `demo/v4.html`, `demo/operational.css`, `demo/operational.js`: dashboard, dossier, activity-officer scope, documents, reports, and exact official-form preview.
- Modify `tests/e2e/reports-print.spec.ts`: form/minutes/annual/impact page-size tests.
- Create `tests/e2e/activity-dossier.spec.ts`: authenticated full-platform journeys.
- Modify `tests/demo-e2e/operational-demo.spec.ts`: public demo parity journeys.

---

### Task 1: Versioned dossier contract and pure logic

**Files:**
- Create: `src/features/activity-dossier/contract.ts`
- Create: `src/features/activity-dossier/contract.test.ts`

**Interfaces:**
- Produces: `ActivityDossierListItem`, `ActivityDossier`, `DossierDocument`, `DossierReadiness`, `filterActivityDossiers(items, filters)`, `deriveDossierReadiness(items)`.
- Consumes: `GovernanceRole` from `src/lib/auth/permissions.ts`.

- [ ] **Step 1: Write failing contract and filter tests**

```ts
import { describe, expect, it } from 'vitest';
import { deriveDossierReadiness, filterActivityDossiers } from './contract';

describe('activity dossier contract', () => {
  it('combines year, department and bilingual program search with AND semantics', () => {
    const result = filterActivityDossiers(FIXTURES, {
      reportingYear: 2026,
      departmentId: 'dept-training',
      search: 'patient safety',
    });
    expect(result.map((row) => row.activityCode)).toEqual(['HT-2026-002']);
  });

  it('does not count final impact as pre-submission committee readiness', () => {
    expect(deriveDossierReadiness([
      { code: 'OFFICIAL_FORM', requiredFor: 'COMMITTEE', state: 'VERIFIED' },
      { code: 'FINAL_IMPACT', requiredFor: 'POST_ACTIVITY', state: 'MISSING' },
    ])).toMatchObject({ committeeMissing: 0, postActivityMissing: 1 });
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/features/activity-dossier/contract.test.ts`  
Expected: FAIL because `contract.ts` does not exist.

- [ ] **Step 3: Implement strict contract and pure helpers**

```ts
export type DossierFilters = {
  reportingYear: number | null;
  departmentId: string | null;
  search: string;
};

export function filterActivityDossiers(
  items: readonly ActivityDossierListItem[],
  filters: DossierFilters,
): ActivityDossierListItem[] {
  const q = filters.search.trim().toLocaleLowerCase('ar');
  return items.filter((item) =>
    (filters.reportingYear === null || item.reportingYear === filters.reportingYear) &&
    (filters.departmentId === null || item.department.id === filters.departmentId) &&
    (!q || [item.activityCode, item.titleAr, item.titleEn ?? '']
      .some((value) => value.toLocaleLowerCase('ar').includes(q)))
  );
}
```

Define document categories exactly as `OFFICIAL_FORM`, `COMMITTEE_DECISION`, `COMMITTEE_MINUTES`, `FINAL_IMPACT_REPORT`, and `ADDITIONAL_ATTACHMENT`. Define readiness phases separately as `COMMITTEE` and `POST_ACTIVITY`.

- [ ] **Step 4: Run contract tests and typecheck**

Run: `npm test -- src/features/activity-dossier/contract.test.ts && npm run typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/activity-dossier/contract.ts src/features/activity-dossier/contract.test.ts
git commit -m "feat: define activity dossier contract"
```

### Task 2: Database authorization, read model and document version metadata

**Files:**
- Create: `supabase/migrations/20260818120000_activity_dossier.sql`
- Create: `tests/sql/phase_15_activity_dossier.sql`

**Interfaces:**
- Produces RPCs `list_activity_dossiers_command(uuid,text,integer,uuid,text)`, `get_activity_dossier_command(uuid,text,uuid)`, and `resolve_activity_document_download_command(uuid,text,uuid,text,uuid)`.
- Consumes existing `current_role_has_permission`, `current_user_is_assigned_activity`, `log_audit_event`, activities, departments, assignments, intake documents, evidence, decisions, minutes, impact reports and status history.

- [ ] **Step 1: Write failing SQL acceptance tests**

The test must create two organizations, four authorized role contexts, one assigned Activity Officer, one unassigned Activity Officer activity, and representative documents. Assert:

```sql
select public._assert(
  (select count(*) from public.list_activity_dossiers_command(
    p_org_a,'ACTIVITY_OFFICER',2026,null,'')
  ) = 1,
  'Activity Officer sees only assigned activities'
);

select public._assert(
  (select count(*) from public.list_activity_dossiers_command(
    p_org_a,'COMMITTEE_SECRETARY',2026,null,'')
  ) = 2,
  'Secretary sees all organization activities'
);
```

Also assert SQLSTATE `42501` for unassigned dossier and document resolution, and zero rows from the other tenant.

- [ ] **Step 2: Run the new SQL test and verify RED**

Run after local Supabase/Postgres preparation:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/phase_15_activity_dossier.sql
```

Expected: FAIL because the functions do not exist.

- [ ] **Step 3: Implement role-scoped RPCs and indexes**

Every RPC begins with active-role permission validation and applies:

```sql
if not (
  public.current_role_has_permission(p_organization_id,p_role_context,'activity.view.all')
  or (
    public.current_role_has_permission(p_organization_id,p_role_context,'activity.view.assigned')
    and public.current_user_is_assigned_activity(p_activity_id)
  )
) then
  raise exception using errcode='42501', message='Activity is not available';
end if;
```

Use organization predicates on every table reference. Return separate lifecycle, committee, external and impact states; never compress them into one status. Add `version_no`, `original_filename`, `storage_path`, `sha256`, `uploaded_by`, `uploaded_at`, verification and lock metadata where available. Revoke from `public` and grant execute only to `authenticated`.

- [ ] **Step 4: Run all SQL migrations and tests in order**

```bash
for file in $(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | sort); do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"; done
for file in $(find tests/sql -maxdepth 1 -type f -name 'phase_*.sql' | sort -V); do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"; done
```

Expected: all migrations and phase suites PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260818120000_activity_dossier.sql tests/sql/phase_15_activity_dossier.sql
git commit -m "feat: add governed activity dossier read model"
```

### Task 3: Full-platform dashboard filters and assigned-activity scope

**Files:**
- Create: `src/features/activity-dossier/queries.ts`
- Create: `src/features/activity-dossier/queries.test.ts`
- Create: `src/features/activity-dossier/activity-dashboard.tsx`
- Modify: `src/app/(app)/activities/page.tsx`

**Interfaces:**
- Consumes `ActivityDossierListItem` and `filterActivityDossiers` from Task 1; `list_activity_dossiers_command` from Task 2.
- Produces `listActivityDossiers(context, filters)` and `<ActivityDashboard items departments annualReports activeRole />`.

- [ ] **Step 1: Write failing query-mapping and UI tests**

Assert that department metadata, separate states, readiness counts, and last-updated time map without default synthetic values. Render the dashboard and verify year + department + name filter intersection and the Activity Officer assigned-only heading.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/features/activity-dossier/queries.test.ts src/features/activity-dossier/contract.test.ts`  
Expected: FAIL because the query and component do not exist.

- [ ] **Step 3: Implement server query and client dashboard**

The server page calls `requireServerAuthContext()` and accepts only roles with `activity.view.all` or `activity.view.assigned`. The client component filters the already authorized result set and links each row to `/activities/{id}/dossier`. The annual-report link appears only for a selected year and only when `annual.view` is present.

- [ ] **Step 4: Run unit, type and lint checks**

Run: `npm test -- src/features/activity-dossier && npm run typecheck && npm run lint`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/activity-dossier src/app/'(app)'/activities/page.tsx
git commit -m "feat: add governed activity dashboard"
```

### Task 4: Unified dossier page, authorized downloads and attachment upload

**Files:**
- Create: `src/app/(app)/activities/[id]/dossier/page.tsx`
- Create: `src/features/activity-dossier/dossier-sections.tsx`
- Create: `src/app/api/activities/[id]/documents/[documentId]/route.ts`
- Modify: `src/app/(app)/activities/[id]/intake/file-actions.ts`
- Test: `src/app/api/activities/[id]/documents/[documentId]/route.test.ts`

**Interfaces:**
- Consumes `get_activity_dossier_command` and `resolve_activity_document_download_command` from Task 2.
- Produces one dossier route and one server-authorized 303 redirect to a 60–300 second private Storage URL.

- [ ] **Step 1: Write failing download-route tests**

Test authorized assigned access, unauthorized unassigned access, cross-tenant denial, unknown document denial, and absence of storage paths in error bodies.

```ts
expect(authorized.status).toBe(303);
expect(authorized.headers.get('location')).toMatch(/^https:\/\//);
expect(unassigned.status).toBe(404);
expect(await unassigned.text()).not.toContain('storage_path');
```

- [ ] **Step 2: Run route tests and verify RED**

Run: `npm test -- src/app/api/activities/[id]/documents/[documentId]/route.test.ts`  
Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the dossier and download boundary**

Render seven focused sections: overview, official application, committee record, impact, attachments, readiness and audit timeline. Use `createPrivateDocumentSignedUrl` only after RPC authorization. Record the governed download audit event in the authorization RPC. Never pass `storage_path` to the browser.

- [ ] **Step 4: Connect upload forms for Activity Officer**

Reuse `uploadEvidenceAction`; add hidden `returnTo=dossier` and validate it against the literal allowed value before redirecting. Keep upload types to PDF, DOCX, JPEG and PNG and maximum 20 MiB. Failed uploads must clean up the newly uploaded object and preserve the registered prior version.

- [ ] **Step 5: Run tests and build**

Run: `npm test -- src/app/api/activities src/features/activity-dossier && npm run typecheck && npm run build`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/'(app)'/activities/'[id]'/dossier src/features/activity-dossier/dossier-sections.tsx src/app/api/activities src/app/'(app)'/activities/'[id]'/intake/file-actions.ts
git commit -m "feat: add unified activity dossier"
```

### Task 5: Exact six-page official application renderer

**Files:**
- Create: `public/templates/schs-activity-application-v1/page-1.svg` through `page-6.svg`
- Create: `demo/templates/schs-activity-application-v1/page-1.svg` through `page-6.svg`
- Create: `src/features/official-form/field-map.ts`
- Create: `src/features/official-form/field-map.test.ts`
- Create: `src/features/official-form/official-form-print.tsx`
- Create: `src/app/(app)/activities/[id]/official-form/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes the uploaded Word source, approved activity template/mapping version, and structured intake data.
- Produces `<OfficialFormPrint pages fields values />` with six `.official-form-letter-page` elements.

- [ ] **Step 1: Derive immutable page artwork from the uploaded source**

Use the document/PDF render workflow to convert the Word source to a six-page PDF and then one SVG per page. Confirm source page size is Letter and compare all six rendered pages visually before copying identical SVG assets into `public/` and `demo/`.

- [ ] **Step 2: Write failing field-map and asset-parity tests**

```ts
expect(OFFICIAL_FORM_PAGES).toHaveLength(6);
for (const field of OFFICIAL_FORM_FIELDS) {
  expect(field.page).toBeGreaterThanOrEqual(1);
  expect(field.page).toBeLessThanOrEqual(6);
  expect(field.x + field.width).toBeLessThanOrEqual(816);
  expect(field.y + field.height).toBeLessThanOrEqual(1056);
}
expect(hash(publicPage)).toBe(hash(demoPage));
```

Include every source field: bilingual titles, type, delivery, specialty, languages, dates, collaboration conditions, content developer conditions, committee members, audience/category, gap, needs-assessment tools, aim/outcomes, SMART objectives, learning/evaluation methods, agenda, speaker details/CV summary, scope and SCFHS registration number.

- [ ] **Step 3: Run field-map tests and verify RED**

Run: `npm test -- src/features/official-form/field-map.test.ts`  
Expected: FAIL before the map and assets exist.

- [ ] **Step 4: Implement mapping, blank handling and overflow rejection**

Use fixed source coordinates and per-field `maxLines`, `fontSize`, and direction. Undefined/null values render as an empty string, not `—`. `validateOfficialFormValues()` returns field keys that overflow and blocks final print/export until corrected.

- [ ] **Step 5: Implement isolated Letter printing**

```css
@media print {
  body:has(.official-form-print-root) { margin: 0; background: white; }
  body:has(.official-form-print-root) .app-shell,
  body:has(.official-form-print-root) .no-print { display: none !important; }
  .official-form-letter-page {
    width: 8.5in;
    height: 11in;
    break-after: page;
    overflow: hidden;
  }
  @page { size: Letter; margin: 0; }
}
```

- [ ] **Step 6: Render all pages and visually compare**

Capture each page at print resolution and compare the blank renderer to the source page. Accept only unchanged base artwork, exact six-page count, and fields contained inside their original boxes.

- [ ] **Step 7: Run tests and commit**

```bash
npm test -- src/features/official-form && npm run typecheck
git add public/templates demo/templates src/features/official-form src/app/'(app)'/activities/'[id]'/official-form src/app/globals.css
git commit -m "feat: reproduce official six-page activity form"
```

### Task 6: Impact, minutes and annual-report integration and print guarantees

**Files:**
- Modify: `src/app/(app)/impact/[id]/page.tsx`
- Modify: `src/app/(app)/impact/[id]/report/[reportId]/page.tsx`
- Modify: `src/app/(app)/reports/minutes/[id]/page.tsx`
- Modify: `src/app/(app)/annual-reports/[id]/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/reports-print.spec.ts`

**Interfaces:**
- Consumes existing `impact.manage`, `impact.view`, `impact.finalize`, `minutes.draft`, `minutes.finalize`, `annual.view` and report records.
- Produces dossier navigation and deterministic print surfaces without changing finalization authority.

- [ ] **Step 1: Extend print tests before UI changes**

Add assertions for:

```ts
await expect(page.locator('.impact-report-root .report-page')).toHaveCount(2);
await expect(page.locator('.minutes-print-root .report-page')).toHaveCount(1);
await expect(page.locator('.annual-report-root .report-page')).toHaveCount(1);
await expect(page.locator('.official-form-print-root .official-form-letter-page')).toHaveCount(6);
```

For every page, assert `scrollHeight <= clientHeight + 1` and expected physical width/height under print media.

- [ ] **Step 2: Run print tests and verify RED**

Run: `npm run test:e2e:auth -- --grep "print|official form"`  
Expected: FAIL for minutes/annual/form deterministic containers.

- [ ] **Step 3: Implement report containers and dossier links**

Preserve final impact report at exactly two A4 pages. Give minutes and annual report explicit `.report-page` containers and page-break rules. Activity Officer can enter L1–L4 and generate permitted interim/final outputs only for assigned activities, as already enforced by `enforce_impact_activity_scope`.

- [ ] **Step 4: Run print and role tests**

Run: `npm run test:e2e:auth`  
Expected: PASS with no skipped print checks.

- [ ] **Step 5: Commit**

```bash
git add src/app/'(app)'/impact src/app/'(app)'/reports/minutes src/app/'(app)'/annual-reports src/app/globals.css tests/e2e/reports-print.spec.ts
git commit -m "fix: make dossier reports print deterministically"
```

### Task 7: Cloudflare demonstration parity

**Files:**
- Create: `demo/activity-dossiers.synthetic.js`
- Create: `tests/contracts/activity-dossier-demo.test.ts`
- Modify: `demo/v4.html`
- Modify: `demo/operational.css`
- Modify: `demo/operational.js`
- Modify: `tests/demo-e2e/operational-demo.spec.ts`

**Interfaces:**
- Consumes contract vocabulary from Task 1 and identical official-form SVG assets from Task 5.
- Produces buildless synthetic dashboard/dossier behavior at `demo/v4.html`.

- [ ] **Step 1: Write failing demo contract and journey tests**

Test all-activity visibility for System Administrator, Secretary and Chair; one/multiple assigned activities for Activity Officer; unassigned denial; year + department + name filtering; annual link by year; dossier document isolation; upload simulation; L1–L4 entry; impact report generation; six Letter pages and visible synthetic-data notice.

- [ ] **Step 2: Run demo tests and verify RED**

Run: `npm test -- tests/contracts/activity-dossier-demo.test.ts && npm run test:e2e:demo`  
Expected: FAIL on missing dashboard/dossier functionality.

- [ ] **Step 3: Implement synthetic fixture and UI parity**

Keep data browser-local. The selected Activity Officer fixture carries explicit `assignedActivityIds`; every open action checks that list. File upload records filename/size/time in browser memory only and displays `بيانات عرض مصطنعة — لا تُرفع ملفات حقيقية`.

- [ ] **Step 4: Run demo tests and mobile checks**

Run: `npm test -- tests/contracts/activity-dossier-demo.test.ts && npm run test:e2e:demo`  
Expected: PASS on desktop and configured mobile viewport.

- [ ] **Step 5: Commit**

```bash
git add demo tests/contracts tests/demo-e2e/operational-demo.spec.ts
git commit -m "feat: add activity dossier to Cloudflare demo"
```

### Task 8: Authenticated end-to-end role journeys

**Files:**
- Modify: `tests/e2e/seed-local.mjs`
- Create: `tests/e2e/activity-dossier.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes all full-platform routes and database rules from Tasks 2–6.
- Produces deterministic seeded journeys in the authenticated UAT suite.

- [ ] **Step 1: Seed exact role and document scenarios**

Create synthetic fixtures for: two departments; two 2026 activities; one 2025 activity; one Activity Officer assigned to one activity; a second fixture assigned to multiple activities; final committee decision and minutes; final impact report; official-form intake document; one additional evidence document; annual reports for 2025 and 2026.

- [ ] **Step 2: Write role journeys**

Verify the three all-activity roles, both Activity Officer assignment scenarios, direct unassigned URL denial, authorized document download redirect, attachment upload, L1–L4 form access, report generation visibility, annual-report year link, and no cross-tenant metadata.

- [ ] **Step 3: Add the suite to authenticated UAT**

Update:

```json
"test:e2e:uat": "playwright test tests/e2e/login-role-context.spec.ts tests/e2e/activity-lifecycle.spec.ts tests/e2e/activity-dossier.spec.ts tests/e2e/all-roles-clarity.spec.ts tests/e2e/reports-print.spec.ts"
```

- [ ] **Step 4: Run full authenticated UAT**

Run: `npm run test:e2e:uat`  
Expected: PASS with no skipped dossier or print tests.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/seed-local.mjs tests/e2e/activity-dossier.spec.ts package.json
git commit -m "test: cover unified dossier role journeys"
```

### Task 9: Full verification, deployment documentation and release

**Files:**
- Modify: `docs/uat/production-readiness-uat.md`
- Modify: `docs/deployment/cloudflare-supabase-free.md`

**Interfaces:**
- Consumes the complete implementation.
- Produces a reproducible release record and verified public synthetic demonstration.

- [ ] **Step 1: Run the complete local quality gate**

```bash
npm ci
npm audit --omit=dev --audit-level=high
npm test
npm run typecheck
npm run lint
npm run security:release
npm run build
npm run test:e2e:smoke
npm run test:e2e:demo
npm run test:e2e:uat
npm run test:deployment
```

Expected: every command exits 0. Any failure blocks release and is fixed with a regression test before continuing.

- [ ] **Step 2: Re-run SQL acceptance suites on a clean database**

Apply every migration in filename order and every `phase_*.sql` test in version order. Expected: PASS, including Phase 15 tenant/assignment/document checks.

- [ ] **Step 3: Perform visual print audit**

Render and inspect: all six Letter application pages; both A4 impact pages; minutes; annual report. Record page count, physical size, overflow result, Arabic/English direction, and source-template comparison in `docs/uat/production-readiness-uat.md`.

- [ ] **Step 4: Update deployment and UAT documentation**

Document that the Pages site is synthetic/browser-local, the full platform uses Supabase/RLS/private Storage, internal approval is not SCFHS accreditation, and all dossier release gates passed with exact commands and dates.

- [ ] **Step 5: Commit final verification record**

```bash
git add docs/uat/production-readiness-uat.md docs/deployment/cloudflare-supabase-free.md
git commit -m "docs: record dossier production readiness"
```

- [ ] **Step 6: Push the implementation branch and verify CI**

Push `deploy/cloudflare-supabase-demo`, confirm PR checks and CodeQL are green, and do not merge through a failing or pending required check.

- [ ] **Step 7: Deploy and verify the public Cloudflare Pages surface**

After CI passes, deploy the `demo` output, open the public URL, and repeat the System Administrator and Activity Officer journeys plus six-page official-form print preview. Confirm the public site contains only synthetic data.

---

## Plan self-review result

- Spec coverage: all source, role, dashboard, dossier, readiness, document, print, parity, error, security, and deployment requirements map to Tasks 1–9.
- Completeness scan: no deferred or incomplete behavior remains.
- Type consistency: the shared `ActivityDossier`/`ActivityDossierListItem` contract is created in Task 1 and consumed by every later UI and parity task; database RPC names are fixed in Task 2 and reused unchanged.
- Scope: the nine tasks form one vertical feature; each task leaves a reviewable, independently tested deliverable.
