# Deployment Runbook

## Release Principle

Deploy only from a reviewed and green `main` commit. Never deploy from an unreviewed feature branch.

## Required Environment Inputs

Production deployment requires values held by the hosting/Supabase secret stores, not GitHub source files:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` / approved public client key
- `SUPABASE_SERVICE_ROLE_KEY` — server-only
- production domain/origin configuration
- approved AI provider settings only if the privacy gate has been approved

## Pre-Deployment Gate

Before production promotion:

1. `npm audit --omit=dev --audit-level=high`
2. unit tests
3. TypeScript
4. ESLint
5. security release check
6. production build
7. clean migration application / SQL acceptance suites
8. authenticated browser UAT
9. CodeQL security analysis
10. no unresolved Critical/High blocker
11. backup/restore capability confirmed for the target environment
12. target Supabase region, hosting target, domain, and privacy decisions documented

## Database Change Rule

- Migrations are append-only release artifacts.
- Applied production migration files are not edited in place.
- If a migration defect is found after deployment, create a new forward-fix migration.
- Destructive schema changes require explicit backup, impact analysis, rollback/restore criteria, and approved maintenance window.

## Deployment Sequence

1. Record release commit SHA and migration range.
2. Confirm current backup/recovery evidence.
3. Apply database migrations to staging or a production-equivalent verification target.
4. Run release smoke tests.
5. Apply production migrations through the approved deployment identity.
6. Deploy the Next.js application with production secrets supplied by the host.
7. Verify `GET /api/health` returns only the expected non-sensitive health payload.
8. Verify authentication and one synthetic/admin-safe read path.
9. Verify no cross-tenant data is visible.
10. Verify document Storage remains private and no authenticated direct bucket policy has reappeared.
11. Verify audit-chain health.
12. Record release result and operator.

## Post-Deployment Smoke

Minimum checks:

- login page and approved logo;
- Arabic/English toggle;
- organization and Role Context selection;
- dashboard loads only authorized modules;
- one non-destructive read from Activity, Committee, Impact, and Reports where authorized;
- notification page loads;
- `/api/health` is healthy;
- no unexpected server errors in deployment logs.

## Deployment Stop Conditions

Stop promotion if any of the following occurs:

- migration error;
- authentication failure across valid users;
- RLS/tenant isolation discrepancy;
- audit-chain integrity failure without explained test data;
- private document access becomes directly available to tenant browsers;
- final report hashes/snapshots cannot be verified;
- production secret appears in client output or repository;
- Critical/High security finding is unresolved.
