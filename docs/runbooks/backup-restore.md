# Backup and Restore Verification Runbook

## Scope
This runbook defines the code-level backup/restore evidence required before a release. It does not claim that a hosted Supabase production backup exists or has been restored; production backup retention, region, recovery point objective (RPO), and recovery time objective (RTO) must be confirmed in the deployed environment.

## Backup set
A complete production recovery set must include:
1. PostgreSQL database backup.
2. Private storage object inventory and the corresponding stored objects/backups.
3. Deployment release SHA and database migration version.
4. A manifest with SHA-256 integrity digests and object counts.

Never copy secrets, service-role credentials, raw evidence text, or patient/person data into a backup manifest.

## CI restore drill
The repository command `bash scripts/local-backup-restore-drill.sh` performs a deterministic synthetic-data drill:
- dumps the complete CI PostgreSQL database using custom format;
- restores it into an isolated `cpd_restore` database;
- confirms critical governance tables exist;
- compares organization and append-only audit row counts source vs restored copy;
- creates a SHA-256 database/storage manifest;
- validates the manifest with `node scripts/verify-backup-manifest.mjs`.

A release fails if this drill fails.

## Production restore procedure
1. Freeze or route writes away from the affected production database if integrity is uncertain.
2. Select an approved recovery point and record its backup identifier, creation time, region, and integrity metadata.
3. Restore into an isolated recovery project/environment first. Do not overwrite production as the first validation step.
4. Validate migrations and critical tables: organizations, memberships/users/roles, activities/revisions, committee reviews/decisions/minutes, external tracking, impact reports, annual reports, notifications, audit logs, and template/reference metadata.
5. Validate tenant isolation/RLS and private storage signed-access boundaries using synthetic or authorized verification records.
6. Validate audit-chain continuity and immutable/final record protections.
7. Validate private storage inventory against the manifest and spot-check object hashes where available.
8. Run the mandatory release security, SQL acceptance, and authenticated browser UAT gates against the recovery environment.
9. Only after validation, perform the controlled cutover approved by the system owner/security/privacy authority.

## Evidence to retain
Retain the backup ID, manifest SHA, restore job ID, recovery environment ID, start/finish timestamps, release SHA, verification result, approver, and any exceptions. Do not retain credentials in the evidence package.

## External production gate
Before real client/hospital data is admitted, the hosting administrator must provide evidence of enabled production backups, retention, target region/data residency, restore access, and a successfully observed production-like restore drill. CI evidence alone is not a substitute for this operational gate.
