# Phase 1 Foundation Design

## Goal

Establish the secure multi-tenant foundation of the CPD Governance, Accreditation Readiness & Impact Intelligence Platform before any business workflow UI is added.

## Scope

Phase 1 includes only:

- Supabase/PostgreSQL foundation schema
- Organizations and memberships
- Users/profile linkage to Supabase Auth
- Roles, permissions, user roles, active role context
- Departments
- Activity master and activity assignments
- Activity status history base
- Append-only tamper-evident audit foundation
- Row-Level Security tenant isolation
- Server-side permission helpers
- Minimal Next.js Arabic-first application shell, authentication, role-context selector, System Admin activity-create/assign workflow
- Foundation automated tests

No committee review, PDF extraction, AI, SCFHS tracking, impact workflow, annual reporting, or production hospital branding is included in this phase.

## Architecture

Use a single Next.js App Router application with TypeScript strict mode. Supabase provides PostgreSQL, Auth, and later private Storage. Authorization is enforced twice: RLS provides tenant isolation at the database boundary and server-side permission checks enforce role/action rules. UI visibility is convenience only and never the security boundary.

`organization_memberships` is the tenancy root for authenticated users. Roles are granted within an organization. A user can hold multiple roles; the application stores/selects an active role context per request/session without merging the roles into a super-role. This supports a single person acting as both Organization System Admin and Committee Secretary while preserving audit provenance.

## Data model

Foundation entities:

- `organizations`
- `users` linked 1:1 to `auth.users`
- `organization_memberships`
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`
- `departments`
- `activities`
- `activity_assignments`
- `activity_status_history`
- `audit_logs`
- `audit_hash_anchors`

All tenant-owned records carry `organization_id`.

`activities` stores internal workflow state only. Committee decision, external SCFHS status, and impact status are intentionally not overloaded into this field and will be added in their own domains in later phases.

## RBAC rules in this phase

- `ORGANIZATION_SYSTEM_ADMIN`: create activities, assign Activity Officers, manage organization users/roles within the configured permission set.
- `ACTIVITY_OFFICER`: read activities assigned to the user; cannot create activities in MVP.
- `COMMITTEE_SECRETARY`, `COMMITTEE_CHAIR`, `COMMITTEE_MEMBER`, `MANAGEMENT_VIEWER`, `MANAGEMENT_APPROVER`, `AUDITOR`: seeded now for stable identity/RBAC but their business actions arrive in later phases.
- `PLATFORM_SUPER_ADMIN`: platform administration only; no default right to tenant business content.

Sensitive permissions are checked server-side. `activity.final_decision` is seeded only to `COMMITTEE_CHAIR`, even though the decision workflow is not implemented until Phase 4. `methodology.approve` and `annual.acknowledge` are seeded only to `MANAGEMENT_APPROVER`.

## RLS

Every tenant table enables RLS. Policies derive allowed organizations from `organization_memberships` for `auth.uid()`.

Activity Officers get an additional assignment restriction for normal activity reads/writes. System Admin gets organization-wide activity-management permission. Service-role credentials are never exposed to the browser.

Negative tests must demonstrate that a direct API request cannot cross tenant boundaries.

## Audit design

`audit_logs` is INSERT-only for application roles. Database triggers reject UPDATE and DELETE. Each organization has an ordered hash chain using `previous_hash` and `event_hash`; writes serialize per organization to avoid concurrent chain forks. Sensitive events record actor, active role context, entity, before/after metadata where justified, request identifier, timestamp, IP/user-agent when policy permits.

Phase 1 must include a chain-verification function and tests that detect tampering.

## Application shell

Arabic-first RTL. Minimal enterprise shell only:

- Login page
- Organization/role context selection if more than one valid context exists
- System Admin dashboard
- Create Activity form
- Assign Activity Officer flow
- Activity Officer “My Activities” list

No decorative investor dashboard metrics are invented in Phase 1.

## Error handling

- Authentication failure: generic safe message.
- Missing organization membership: 403 and no tenant data.
- Missing permission: 403 even if route/button is manually invoked.
- Cross-tenant identifiers: behave as forbidden/not found according to endpoint design without leaking tenant existence.
- Database errors are logged server-side without exposing secrets.

## Testing

Test-first implementation.

Database tests:

- role seeds and sensitive permission ownership
- RLS same-tenant access
- RLS cross-tenant denial
- admin activity creation
- officer activity-creation denial
- officer assignment-scoped visibility
- audit UPDATE/DELETE denial
- audit hash verification and tamper detection

Application tests:

- active role context is recorded on protected actions
- server action rejects incorrect role context
- create/assign happy path
- Activity Officer list does not leak other assignments

## Acceptance gate

Phase 1 may be proposed for merge only when migrations apply from a clean database, foundation tests pass, TypeScript/build checks pass, and the branch contains no secrets or real hospital/SCFHS branding/data.
