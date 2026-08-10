# Incident Response and Rollback Runbook

## Purpose
This runbook defines the minimum operational response for production incidents affecting the CPD Governance Platform. It does not replace organizational incident-management, privacy, or legal procedures.

## Severity triage
- **P0 — Critical:** confirmed cross-tenant exposure, credential compromise, destructive data loss, tamper-evident audit failure, or unauthorized scientific decision capability.
- **P1 — High:** broad authentication/RBAC failure, private evidence exposure, finalized-record mutation, external-AI privacy gate bypass, or sustained production outage.
- **P2 — Moderate:** degraded document extraction/report generation, delayed notifications, or limited workflow failure without confidentiality/integrity loss.

## Immediate containment
1. Preserve the current release SHA, request IDs, timestamps, affected tenant/entity identifiers, and sanitized error codes. Do not copy raw evidence, document text, passwords, tokens, email addresses, or signatures into tickets/logs.
2. For suspected tenant/privacy exposure, disable the affected route or feature and revoke/rotate server credentials through the deployment secret manager.
3. Keep external AI disabled unless the organization has an approved privacy configuration. If AI processing is implicated, disable the provider feature flag immediately.
4. Do not edit or delete audit events, finalized committee minutes, submitted revisions, or finalized impact reports to “repair” an incident.

## Evidence preservation
Use allowlisted diagnostic metadata only: operation, outcome, request ID, organization ID, entity type/ID, state/status, timestamp, and non-sensitive error code. Preserve database backup identifiers and deployment SHA separately from user-facing evidence.

## Rollback
1. Stop further writes for the affected function if data integrity may be at risk.
2. Roll application code back to the last verified release SHA.
3. Database schema changes are forward-only by default. Do not manually reverse a migration against production data unless a reviewed recovery migration exists.
4. If restoration is required, restore into an isolated environment first and run schema/integrity validation before any production cutover.
5. Re-run authentication/RBAC, RLS, audit-chain, storage-boundary, committee-authority, and final-report acceptance gates before reopening writes.

## Notification and governance
Escalate suspected personal-data incidents to the organization's authorized privacy/security function. Scientific decisions remain owned by the institutional committee; an operational incident or administrator must not silently rewrite a committee decision.

## Recovery exit criteria
Service can return to normal only when the root cause is identified, containment is verified, required credentials are rotated, affected data integrity is validated, mandatory CI/security gates are green on the recovery SHA, and any privacy/governance approvals required by organizational policy are recorded.
