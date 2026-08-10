# Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current governed MVP into a verifiable production-readiness release candidate without expanding the business feature scope.

**Architecture:** Keep the existing Next.js 16 + Supabase architecture. Add reproducible local Supabase configuration for Auth/Storage E2E, Playwright browser acceptance tests, deterministic security/release checks, health/operational documentation, and targeted UX accessibility fixes only where tests expose blockers.

**Tech Stack:** Next.js 16.2.11, React 19, TypeScript 5.8, Supabase/Postgres/Auth/Storage, Vitest, Playwright, GitHub Actions, CodeQL v4.

## Global Constraints

- No new business feature unless required to complete an existing Canonical workflow or fix a release blocker.
- Synthetic data only in automated/UAT tests.
- No production credentials in source control.
- `SUPABASE_SERVICE_ROLE_KEY` remains server-only.
- External AI remains disabled until privacy approval/configuration is explicit.
- Internal committee approval is submission readiness only, never external accreditation.
- Browser plugin is not available in this session; frontend validation uses Playwright.
- Release merge requires zero unresolved Critical/High blockers.

---

### Task 1: Reproducible Browser Test Environment

**Files:**
- Modify: `package.json`
- Create: `supabase/config.toml`
- Create: `tests/e2e/global-setup.ts`
- Create: `tests/e2e/fixtures.ts`
- Create: `playwright.config.ts`

**Interfaces:**
- Produces local Supabase Auth/Storage/DB environment and Playwright `baseURL` on `http://127.0.0.1:3000`.
- Produces synthetic users by role through Supabase Admin in test setup only.

- [ ] **Step 1: Add a failing Playwright smoke test** that expects `/login` to render the platform identity and language control.
- [ ] **Step 2: Run the E2E command in CI and verify RED** because Playwright/config/local Supabase harness is absent.
- [ ] **Step 3: Add pinned `@playwright/test` and `supabase` dev dependencies, `test:e2e` script, Playwright config, and local Supabase config.**
- [ ] **Step 4: Add synthetic Auth/bootstrap setup** using local service-role credentials; never commit real credentials.
- [ ] **Step 5: Re-run E2E smoke and verify GREEN.**

### Task 2: Full Critical-Path E2E / UAT

**Files:**
- Create: `tests/e2e/login-role-context.spec.ts`
- Create: `tests/e2e/activity-lifecycle.spec.ts`
- Create: `tests/e2e/responsive-accessibility.spec.ts`
- Create: `docs/uat/production-readiness-uat.md`

**Interfaces:**
- Consumes synthetic users and local Supabase stack from Task 1.
- Exercises the real Next.js UI and real RLS/RPC boundaries.

- [ ] **Step 1: Write failing role-context tests** proving one multi-role account changes active context without combining scientific/admin permissions.
- [ ] **Step 2: Write failing lifecycle test** for Admin → Officer → Secretary → Chair → External → Impact → Annual Report.
- [ ] **Step 3: Run and record RED failures at the first missing/broken UI step.**
- [ ] **Step 4: Fix only blocking UX/workflow defects discovered by the tests.**
- [ ] **Step 5: Add desktop + mobile viewport smoke and keyboard navigation assertions.**
- [ ] **Step 6: Run the complete Playwright suite and verify GREEN.**

### Task 3: Security Release Gate

**Files:**
- Create: `scripts/security-release-check.mjs`
- Create: `tests/sql/phase_10_production_security.sql`
- Create: `.github/workflows/codeql.yml`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Static check fails on service-role references in client components, committed secret patterns, unsafe public storage configuration, or missing expected RLS/security invariants.
- SQL test proves cross-tenant denial on post-MVP tables and protected approval/decision functions.

- [ ] **Step 1: Write failing static checks** for known forbidden release patterns.
- [ ] **Step 2: Add negative SQL assertions** covering external tracking, impact, annual reporting, notifications, templates, references, and correction workflow.
- [ ] **Step 3: Run checks and verify RED where current gaps exist.**
- [ ] **Step 4: Apply smallest security fixes required by findings.**
- [ ] **Step 5: Add CodeQL v4 JavaScript/TypeScript `security-extended` workflow.**
- [ ] **Step 6: Re-run static/SQL/CodeQL gates and verify no Critical/High blocker remains.**

### Task 4: Operational Health, Backup/Restore, and Release Procedures

**Files:**
- Create: `src/app/api/health/route.test.ts`
- Create: `src/app/api/health/route.ts`
- Create: `docs/operations/backup-restore.md`
- Create: `docs/operations/deployment-runbook.md`
- Create: `docs/operations/incident-rollback.md`
- Create: `docs/operations/environment-matrix.md`

**Interfaces:**
- `GET /api/health` returns minimal non-sensitive application health metadata.
- Operations docs define explicit production/staging actions without embedding secrets.

- [ ] **Step 1: Write failing health-route unit test** asserting no secret/PII fields and deterministic `status`/`service` output.
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Implement minimal health route.**
- [ ] **Step 4: Verify GREEN.**
- [ ] **Step 5: Document backup/restore drill, forward-fix migration recovery, secret inventory, deploy and rollback criteria.**

### Task 5: Report/Print and UX Release QA

**Files:**
- Create: `tests/e2e/reports-print.spec.ts`
- Modify only if tests fail: report pages/components and `src/app/globals.css`

**Interfaces:**
- Playwright validates print surfaces from real structured test data.

- [ ] **Step 1: Write failing print/RTL tests** for final impact report, annual report, and committee minutes.
- [ ] **Step 2: Verify RED at any layout/overflow blocker.**
- [ ] **Step 3: Apply targeted print CSS/component fixes only.**
- [ ] **Step 4: Verify desktop/mobile and print GREEN.**

### Task 6: Release Evidence and CI Gate

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `docs/releases/production-readiness-checklist.md`

**Interfaces:**
- Pull request gate runs dependency audit, unit, types, lint, build, migrations, SQL suites, security check, E2E, and report smoke.

- [ ] **Step 1: Add all new commands to CI** with explicit failure behavior.
- [ ] **Step 2: Run PR CI from a clean branch state.**
- [ ] **Step 3: Inspect failed job logs and fix blockers using systematic debugging.**
- [ ] **Step 4: Re-run full CI and verify all required jobs GREEN.**
- [ ] **Step 5: Mark any environment-only blockers explicitly in the release checklist.**

### Task 7: Final Verification and Merge

**Files:**
- No new behavior; verification only.

- [ ] **Step 1: Re-read the production-readiness design and map every requirement to evidence.**
- [ ] **Step 2: Run fresh full verification on the final SHA.**
- [ ] **Step 3: Open PR `production-readiness → main` with exact test/security evidence.**
- [ ] **Step 4: Merge only when the final PR SHA has green required gates and no unresolved Critical/High finding.**
