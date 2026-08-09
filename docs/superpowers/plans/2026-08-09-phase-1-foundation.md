# Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the secure multi-tenant Next.js + Supabase foundation that supports organization-scoped RBAC, role context, activity creation/assignment, RLS, and tamper-evident audit.

**Architecture:** One Next.js App Router application uses Supabase Auth/PostgreSQL. Database RLS is the tenant boundary; server-side permission checks are the action boundary. Role context is explicit per protected action and is written to append-only audit events.

**Tech Stack:** Next.js stable, TypeScript strict, Tailwind CSS, Supabase PostgreSQL/Auth, Zod, Vitest, Playwright-ready structure.

## Global Constraints

- Arabic-first RTL; English-ready.
- Deny-by-default RBAC; server-side authorization is mandatory.
- All tenant-owned records contain `organization_id` and are protected by RLS.
- `PLATFORM_SUPER_ADMIN` has no default access to tenant business content.
- System Admin cannot exercise scientific approval.
- No secrets, real hospital data, hospital/MOD/SCFHS logos, or fake regulatory claims in the repository.
- Audit records are append-only and tamper-evident.
- `main` is stable; implementation happens on `phase-1-foundation`.

---

### Task 1: Scaffold the Next.js application and test harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `.env.example`
- Create: `.gitignore`

**Interfaces:**
- Produces a TypeScript Next.js App Router shell with `npm test`, `npm run lint`, and `npm run build` scripts.

- [ ] Write a failing smoke test that imports the root-page model/helper before it exists.
- [ ] Run `npm test` and verify RED.
- [ ] Add the minimal application shell and test helper.
- [ ] Run `npm test` and verify GREEN.
- [ ] Run TypeScript/build checks.
- [ ] Commit `chore: scaffold Next.js foundation`.

### Task 2: Foundation database schema

**Files:**
- Create: `supabase/migrations/0001_foundation.sql`
- Create: `tests/sql/phase_1_foundation.sql`

**Interfaces:**
- Produces tables: `organizations`, `users`, `organization_memberships`, `roles`, `permissions`, `role_permissions`, `user_roles`, `departments`, `activities`, `activity_assignments`, `activity_status_history`.

- [ ] Write SQL assertions for required tables, UUID keys, organization ownership, and four-axis status non-overload.
- [ ] Run the SQL suite against a clean PostgreSQL/Supabase-compatible database and verify RED.
- [ ] Implement `0001_foundation.sql` with constraints and indexes.
- [ ] Re-run SQL assertions and verify GREEN.
- [ ] Commit `feat: add foundation data model`.

### Task 3: RBAC seed and permission helpers

**Files:**
- Create: `supabase/migrations/0002_seed_rbac.sql`
- Create: `src/lib/auth/permissions.ts`
- Create: `src/lib/auth/permissions.test.ts`

**Interfaces:**
- Produces role codes and permission codes including `activity.create`, `activity.assign`, `activity.final_decision`, `methodology.approve`, `annual.acknowledge`.
- Produces `hasPermission(context, permission)` pure helper for application tests.

- [ ] Write failing tests proving `COMMITTEE_CHAIR` alone owns `activity.final_decision`, `MANAGEMENT_APPROVER` owns methodology/annual approval permissions, and Activity Officer cannot create activities.
- [ ] Run tests and verify RED.
- [ ] Implement seed SQL and pure permission helper.
- [ ] Verify GREEN.
- [ ] Commit `feat: seed governance RBAC`.

### Task 4: Append-only audit and hash chain

**Files:**
- Create: `supabase/migrations/0003_audit.sql`
- Create: `tests/sql/phase_1_audit.sql`

**Interfaces:**
- Produces `audit_logs`, `audit_hash_anchors`, `log_audit_event(...)`, `verify_audit_chain(...)`.

- [ ] Write failing SQL tests for UPDATE denial, DELETE denial, valid chain, and tamper detection.
- [ ] Run and verify RED.
- [ ] Implement INSERT-only triggers, per-organization serialization, `previous_hash`, `event_hash`, and chain verification.
- [ ] Run and verify GREEN.
- [ ] Commit `feat: add tamper-evident audit log`.

### Task 5: RLS tenant isolation

**Files:**
- Create: `supabase/migrations/0004_rls.sql`
- Create: `tests/sql/phase_1_rls.sql`

**Interfaces:**
- Produces RLS policies based on `organization_memberships` and permission-aware activity policies.

- [ ] Write failing tests for same-tenant read, cross-tenant denial, System Admin activity creation, Activity Officer creation denial, and assignment-scoped officer activity visibility.
- [ ] Run and verify RED.
- [ ] Implement helper SQL functions and RLS policies on every Phase-1 tenant table.
- [ ] Run and verify GREEN.
- [ ] Commit `feat: enforce tenant isolation with RLS`.

### Task 6: Supabase clients, auth profile bootstrap, and role context

**Files:**
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/auth/context.ts`
- Create: `src/lib/auth/context.test.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/app/auth/callback/route.ts`

**Interfaces:**
- Produces `getRequestAuthContext()` returning authenticated user, selected organization, memberships, roles, and active `roleContext`.
- Produces `requirePermission(permission)` for server-only enforcement.

- [ ] Write failing tests for multi-role context selection and invalid-context rejection.
- [ ] Verify RED.
- [ ] Implement clients and context resolution with no service-role exposure to browser code.
- [ ] Verify GREEN.
- [ ] Commit `feat: add auth and role context`.

### Task 7: Activity service with create and assign actions

**Files:**
- Create: `src/features/activities/schema.ts`
- Create: `src/features/activities/service.ts`
- Create: `src/features/activities/service.test.ts`
- Create: `src/app/(app)/admin/activities/actions.ts`

**Interfaces:**
- Produces `createActivity(input, authContext)` and `assignActivityOfficer(activityId, officerMembershipId, authContext)`.

- [ ] Write failing tests that an Organization System Admin can create/assign, Activity Officer cannot create, cross-tenant IDs are rejected, and successful actions emit role-context audit events.
- [ ] Verify RED.
- [ ] Implement Zod validation and server-side permission guards.
- [ ] Verify GREEN.
- [ ] Commit `feat: add governed activity creation and assignment`.

### Task 8: Minimal Arabic-first application shell

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/app-shell.tsx`
- Create: `src/components/role-context-switcher.tsx`
- Create: `src/app/(app)/admin/page.tsx`
- Create: `src/app/(app)/admin/activities/new/page.tsx`
- Create: `src/app/(app)/activities/page.tsx`
- Create: `src/features/activities/activity-form.tsx`

**Interfaces:**
- System Admin sees create/assign workflow.
- Activity Officer sees `My Activities` only.

- [ ] Write component/action tests for role-specific visibility and form validation.
- [ ] Verify RED.
- [ ] Implement restrained RTL enterprise UI with no invented business metrics.
- [ ] Verify GREEN.
- [ ] Commit `feat: add foundation role dashboards`.

### Task 9: Foundation verification and documentation

**Files:**
- Create: `docs/phase-1-foundation-runbook.md`
- Create: `docs/phase-1-gate-report.md`
- Modify: `README.md`

**Interfaces:**
- Documents local/Supabase application order, environment variables, tests, and Gate result.

- [ ] Apply migrations from a clean database.
- [ ] Run the full SQL foundation suite.
- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Inspect git diff for secrets/real organizational data.
- [ ] Record actual command outputs and PASS/FAIL in `docs/phase-1-gate-report.md`.
- [ ] Commit `docs: record phase 1 foundation gate` only if verification evidence supports the recorded status.

## Self-review

- Every Phase-1 design requirement maps to a task above.
- No committee business workflow, AI, PDF extraction, external tracking, or impact UI is pulled forward.
- Security boundaries are enforced in DB/server code, not UI-only.
- The plan requires test-first behavior for business/security code and fresh verification before merge.
