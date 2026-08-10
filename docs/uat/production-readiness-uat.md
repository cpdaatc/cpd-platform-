# Production Readiness UAT

## Scope

This UAT uses synthetic data only. It does not certify SCFHS accreditation, legal compliance, privacy approval, or an independent penetration test.

## Automated Browser Evidence

| Scenario | Automated evidence | Gate |
|---|---|---|
| Public login identity | `tests/e2e/login-smoke.spec.ts` | logo, bilingual sign-in surface |
| Mobile/RTL/keyboard | `tests/e2e/responsive-accessibility.spec.ts` | narrow viewport + keyboard focus |
| Multi-role Role Context | `tests/e2e/login-role-context.spec.ts` | Admin and Secretary remain separated |
| Activity creation + assignment | `tests/e2e/activity-lifecycle.spec.ts` | Admin creates/assigns; Officer sees only assigned activity path |
| Final impact print | `tests/e2e/reports-print.spec.ts` | structured final report + exact 2-page PDF |

The authenticated tests run against a complete disposable local Supabase stack (Auth, Postgres, RLS, Storage) with synthetic users seeded by `tests/e2e/seed-local.mjs`.

## Backend Workflow Evidence

The browser UAT is supplemented by SQL acceptance suites that execute governed server/database transitions:

- Phase 1 — organization/RBAC/RLS/audit/activity commands;
- Phase 2 — intake/evidence/speaker document governance;
- Phase 3 — AI/readiness/privacy/reference rules;
- Phase 4 — institutional committee, revision loop, Chair decision, minutes;
- Phase 5 — external status separation;
- Phase 6 — follow-up policies, L1-L4, HTVI PENDING/final;
- Phase 7 — annual committee report, Chair approval, management acknowledgement;
- Phase 8 — notifications/templates/evidence readiness;
- Phase 9 — planning assistant/reference/user administration;
- Phase 10 — production security invariants.

## Manual Pilot UAT — required before real users

The following is a production/pilot acceptance session, not a code-development blocker that can be fabricated in CI. Run it in the approved staging environment with named institutional testers:

1. Organization System Admin signs in and confirms the correct organization and role context.
2. Admin creates an activity and assigns the Activity Officer.
3. Activity Officer completes the digital form and a separate test activity through PDF/hybrid intake.
4. Verify Activity Scientific Committee members originate from the structured activity record.
5. Verify CV/evidence uploads cannot be accessed from a direct tenant Storage API session.
6. Officer runs readiness/planning assistance and explicitly Accepts/Edits/Rejects suggestions.
7. Officer submits a revision to the Institutional Committee.
8. Secretary records meeting attendance and collective review results.
9. Chair alone performs Return / Not Approve / Approved for Submission decision.
10. Returned activity creates a new working revision and preserves the previous submitted snapshot.
11. Minutes are finalized and preserved as an immutable version.
12. External tracking is entered separately and does not change the meaning of the internal committee decision.
13. Activity conduct is recorded after external approval and generates version-correct impact schedules.
14. Confirm HTVI remains PENDING before all required L1-L4 components are complete.
15. Complete L1-L4 and generate the exact two-page Final Impact Report.
16. Generate Annual Scientific Committee Performance Report; Chair approves; Management acknowledges.
17. Confirm dashboards/notifications/overdue indicators are appropriate for each role.
18. Confirm Arabic/English and mobile navigation are usable.
19. Confirm report printing against the organization-approved templates and branding.
20. Record defects, severity, owner, and re-test evidence.

## Pass Rule

Automated UAT must be green before merge. Manual pilot UAT must be completed before the platform is declared live for real institutional data.
