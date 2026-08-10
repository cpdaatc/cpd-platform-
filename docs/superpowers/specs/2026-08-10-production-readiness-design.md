# Production Readiness Design

## Context

The current CPD Governance, Accreditation Readiness & Impact Intelligence Platform has reached a governed MVP / release-candidate state. The next objective is not feature expansion. The objective is to prove that the existing product can be operated safely, predictably, and clearly from end to end before any production pilot.

## Scope Freeze

No new business features are added during this phase unless they are required to complete an existing Canonical Blueprint workflow or fix a blocking defect discovered by acceptance, security, resilience, accessibility, or document-output testing.

The platform continues to enforce the governing principle that an internal committee decision represents readiness for submission only; external SCFHS accreditation is a separate externally evidenced status.

## Goal

Produce a production-readiness release candidate that demonstrates:

- one complete synthetic activity journey across all operational roles;
- browser-level E2E coverage for authentication, role context, activity workflow, committee decision, external tracking, impact, and reports;
- negative security checks for tenant isolation, role boundaries, storage access, service-role exposure, and privileged server actions;
- operational readiness for backup/restore, health checks, error diagnostics, and deployment secrets;
- UX clarity centered on "what do I need to do now?" for each active role;
- deterministic PDF/report QA rules and release evidence.

## Chosen Approach

Use one dedicated `production-readiness` branch and one release-gate pull request. Keep the existing Next.js + Supabase architecture. Do not introduce microservices, Kubernetes, a second ORM, or a second application runtime.

Testing is layered:

1. existing Vitest + SQL acceptance suites remain mandatory;
2. Playwright is added for browser E2E and responsive/accessibility smoke tests;
3. production-readiness checks are deterministic scripts executed in CI;
4. real deployment remains blocked until environment-specific Supabase/hosting secrets and region decisions are supplied outside source control.

## Workstreams

### 1. End-to-End Acceptance

Add Playwright and a synthetic UAT scenario covering:

- login and organization/role context selection;
- Organization System Admin creates an activity and assigns an Activity Officer;
- Activity Officer completes intake and submits for committee review;
- Committee Secretary prepares and records the collective review;
- Committee Chair performs the final internal decision;
- external status is recorded independently;
- activity is marked conducted;
- L1-L4 impact data is completed according to an approved follow-up policy;
- HTVI remains PENDING until all required components are complete;
- final impact report is generated;
- annual report is generated, Chair-approved, and Management-acknowledged;
- report center exposes final outputs for printing.

E2E must use synthetic data only. No hospital, SCFHS, or real-person data is required.

### 2. Security Hardening

Review and test:

- RLS on every tenant table introduced through the latest migrations;
- private storage buckets and organization-scoped paths;
- `SUPABASE_SERVICE_ROLE_KEY` server-only usage;
- security-definer functions for explicit authorization and organization checks;
- no browser bundle access to service-role or private credentials;
- Chair-only final activity decisions;
- Management-only methodology/privacy approvals where configured;
- append-only audit integrity and chain verification;
- AI external processing off by default unless the privacy gate is approved.

No claim of formal penetration-test certification is made. This phase produces an internal security release gate and a list of items requiring independent penetration testing before production launch.

### 3. Operational Resilience

Add documented and testable operational procedures for:

- database backup and restore;
- storage backup inventory and restore verification;
- migration rollback strategy based on forward-fix migrations rather than destructive down migrations;
- environment-variable inventory with client/server separation;
- health/readiness endpoint that does not expose sensitive data;
- structured production error logging hooks without PII;
- release checklist and rollback decision criteria.

The repository must never contain production secrets.

### 4. UX and Accessibility QA

Focus on task completion, not decorative redesign.

Each role dashboard must clearly show:

- current role context;
- pending actions;
- overdue items;
- blocked items with reason;
- next primary action.

Navigation must remain permission-aware, Arabic-first RTL, English-ready, usable on mobile, and keyboard accessible. Playwright smoke tests cover major mobile/desktop viewports and key keyboard interactions.

### 5. Document and Printing QA

The report center must use live structured data rather than duplicate demo data. Release checks cover:

- final impact report print layout;
- exact two-page body constraint where the product specifies it;
- deterministic overflow to Detailed Impact Annex;
- annual report printable layout;
- committee minutes printable layout;
- RTL rendering and bilingual mixed-content smoke checks.

No logo, signature, or regulatory mark is fabricated. Only repository-approved assets are used.

## Release Gates

The branch may merge only when all of the following are green:

- `npm audit --omit=dev --audit-level=high`;
- unit tests;
- TypeScript;
- ESLint;
- production build;
- all SQL migrations from a clean PostgreSQL database;
- all SQL acceptance suites;
- Playwright E2E critical journey;
- cross-tenant and role-boundary negative tests;
- production-readiness static security checks;
- print/report smoke checks;
- no committed secret scan findings;
- no unresolved blocker classified Critical or High.

## Explicit External Blockers

The following cannot be solved by source-code changes alone and remain deployment gates:

- production Supabase project and processing region;
- production hosting target and domain;
- production secrets configured in the hosting secret store;
- independent privacy/legal confirmation for external AI processing and cross-border transfer if applicable;
- independent penetration test before handling real institutional data;
- approved source files/templates and production branding assets where required.

## Success Criterion

The phase succeeds when a reviewer can take a clean checkout, run the automated release gates, reproduce the synthetic end-to-end workflow, inspect the operational/security evidence, and conclude that the remaining blockers are environment or organizational approvals rather than missing core product behavior.
