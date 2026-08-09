# Phase 0 — Freeze Pack

## CPD Governance, Accreditation Readiness & Impact Intelligence Platform

**Baseline:** Canonical Blueprint & Master Build Prompt v1.1  
**Status:** Phase 0 / Freeze  
**Governing rule:** The platform does not grant SCFHS accreditation. Internal approval means readiness for submission only; accreditation is an external decision.

## Phase gates

`Phase 0 Freeze → Phase 1 Foundation → Phase 2 Intake → Phase 3 AI → Phase 4 Committee → Phase 5 External → Phase 6 Impact → Phase 7 Annual → Phase 8 Evidence/Demo`

No phase is merged to `main` without a gate result.

## Locked architecture decisions

- Tenant-owned records carry `organization_id`; Supabase RLS is mandatory.
- Deny-by-default RBAC and server-side authorization.
- One user may hold multiple roles; actions record the active `role_context`.
- System Admin manages the system but cannot make scientific decisions.
- Committee Secretary records collective review; Committee Chair alone makes the final internal activity decision.
- Activity Scientific Committee is activity-specific and separate from the permanent Institutional Scientific Committee.
- Digital, uploaded-PDF, and hybrid intake converge into one structured activity record.
- Uploaded originals are immutable and hashed; uncertain extraction is never guessed.
- Evidence availability is separate from committee assessment.
- Evidence states: `UPLOADED`, `OFFLINE_REVIEWED`, `NOT_APPLICABLE`, `MISSING`; no generic Skip.
- `OFFLINE_REVIEWED` requires `recorded_by`, authorized `verified_by`, `verified_at`, evidence location, and confirmation that the original existed at review time.
- Every committee submission becomes an immutable activity revision; returns create revision N+1.
- Final minutes are immutable; corrections create a new controlled version.
- External SCFHS tracking is separate and manual in MVP.
- Impact follow-up timing is versioned policy, not hard-coded.
- Interim Impact Summary is non-final. Final Impact Report is exactly two pages and only after methodology-required components are complete/approved N/A.
- HTVI is internal, versioned, server-calculated, and remains `PENDING` until required components are complete; no partial reweighting.
- HTVI methodology and follow-up policy are configured by System Admin and activated by `MANAGEMENT_APPROVER`.
- Annual committee report: system aggregates → Secretary validates/drafts → Chair approves → Management acknowledges.
- In-app notifications are mandatory; email is optional by feature flag.
- Official templates and their coordinate mappings are independently versioned with visual QA and activation dates.
- External AI is disabled by default in production until organizational privacy configuration approves provider/region/transfer; minimize/redact PII.
- Audit is append-only, DB-protected from UPDATE/DELETE, with `previous_hash`/`event_hash` tamper evidence.
- Arabic-first RTL, English-ready; preserve source-language evidence.
- Investor demo uses synthetic data and generic branding only.

## Core roles

- `PLATFORM_SUPER_ADMIN`
- `ORGANIZATION_SYSTEM_ADMIN`
- `ACTIVITY_OFFICER`
- `COMMITTEE_SECRETARY`
- `COMMITTEE_CHAIR`
- `COMMITTEE_MEMBER`
- `MANAGEMENT_VIEWER`
- `MANAGEMENT_APPROVER`
- optional `AUDITOR`

## Four independent status dimensions

1. Internal workflow
2. Committee decision
3. External SCFHS status
4. Impact status

Never compress these into one overloaded status field.

## Phase 1 gate

Phase 1 must establish and verify:

- organizations and memberships
- users, roles, permissions, user roles, role context
- departments
- activity master and assignments
- audit base, append-only protection and hash chain
- RLS tenant isolation
- server-side permission helpers
- foundation test suite, including negative cross-tenant access

The branch may merge only after Foundation tests pass.
