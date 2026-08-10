# Incident and Rollback Decision Guide

## Objective

Provide a controlled response to a failed release or production incident without bypassing governance, deleting audit evidence, or introducing ad-hoc database changes.

## Severity Triggers

Treat the following as release-blocking / urgent security incidents until triaged:

- suspected cross-tenant data exposure;
- service-role or other private credential exposure;
- unauthorized Chair/Management approval action;
- private document exposure;
- unexplained audit-chain integrity failure;
- corruption or loss of finalized committee/report snapshots;
- authentication outage affecting valid users;
- failed migration leaving schema/application versions incompatible.

## Immediate Containment

1. Stop additional deployments.
2. Preserve application/database/security logs and the release SHA.
3. Revoke/rotate a credential immediately if exposure is suspected; do not commit the replacement.
4. Disable the affected application route or integration if containment can be achieved without corrupting data.
5. External AI can be disabled at the organization privacy/configuration gate without altering historical records.
6. Do not delete or rewrite audit records.

## Rollback Strategy

Application code may be rolled back to the last known-good release only if the database schema remains backward compatible.

Database migrations use **forward-fix** as the default. Do not run improvised destructive down migrations in production.

If the database state itself must be restored:

- use the approved database backup/restore procedure;
- separately restore Storage object bytes as required;
- verify restored audit/hash/checksum evidence;
- document data-loss window against the approved RPO.

## Decision Matrix

| Condition | Preferred action |
|---|---|
| UI/runtime regression, schema compatible | roll application back to last known-good SHA |
| bad non-destructive schema change | forward-fix migration + controlled redeploy |
| destructive/corrupting DB change | stop writes, restore/failover per approved recovery plan |
| exposed secret | rotate secret, invalidate old credential, redeploy, investigate access logs |
| tenant isolation failure | disable affected access path immediately; do not resume until negative isolation tests pass |
| generated report defect | preserve finalized historical version; use governed correction/versioning workflow |

## Recovery Verification

Before reopening normal use:

- release/security CI is green on the recovery SHA;
- tenant isolation is re-tested;
- authentication and role context work;
- audit chain is verified;
- affected report/document hashes are checked;
- health endpoint is normal;
- incident timeline, decisions, and residual risk are recorded.
