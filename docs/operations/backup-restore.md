# Backup and Restore Runbook

## Purpose

Define the minimum operational evidence required before the CPD platform handles real institutional data.

## Scope

Backups are treated as two separate assets:

1. PostgreSQL database data/schema/roles.
2. Private `cpd-documents` Storage object bytes.

A database restore alone is not a complete platform restore because Storage object bytes must be protected and restored separately from their database metadata.

## Production Backup Policy — decision required before launch

The organization must approve and record:

- database backup mechanism and retention;
- required RPO/RTO;
- Storage object backup destination and retention;
- encryption and access control for backup copies;
- restore-test frequency;
- owner and deputy for restore authorization.

The source repository does not hard-code a paid backup tier or retention period.

## Logical Database Export

Use Supabase CLI / supported Postgres tooling with a production connection supplied through the operator secret store. Never place the connection string or password in the repository.

Example operator sequence:

```bash
supabase db dump --db-url "$DATABASE_URL" -f roles.sql --role-only
supabase db dump --db-url "$DATABASE_URL" -f schema.sql
supabase db dump --db-url "$DATABASE_URL" -f data.sql --use-copy --data-only
```

Store generated files in the approved encrypted backup destination, not in GitHub.

## Storage Object Backup

Back up all objects under the private `cpd-documents` bucket independently. Preserve:

- object path;
- bytes;
- content type where available;
- object size;
- backup timestamp;
- checksum/inventory manifest.

The platform database already stores SHA-256 hashes for key governed documents. Restore verification should compare restored bytes against the saved application checksum when one exists.

## Restore Drill

Perform restore testing in an isolated non-production environment.

1. Create or identify an isolated recovery environment.
2. Restore database roles/schema/data using the approved Supabase/Postgres procedure.
3. Restore the private Storage objects from the independent object backup.
4. Confirm Auth/configuration required by the recovery environment without copying production secrets into source control.
5. Run all application migrations that are newer than the restored snapshot.
6. Run production release checks.
7. Verify at minimum:
   - organizations and memberships;
   - Role Context assignments;
   - one activity with its revision history;
   - committee decision/minutes snapshot;
   - one final impact report and hash;
   - one Storage object checksum;
   - audit-chain verification.
8. Record actual elapsed restore time and the newest successfully recovered transaction/object timestamp.
9. Destroy or sanitize the recovery environment according to the approved data-handling procedure.

## Acceptance Evidence

A restore drill is PASS only when:

- database and Storage objects are both restored;
- governed snapshot hashes/checksums are consistent;
- audit chain verification produces no unexplained break;
- the application can authenticate a synthetic/recovery test account and read only its authorized tenant data;
- actual RTO/RPO observations are recorded.

## Failure Handling

Do not overwrite the only viable backup while investigating a failed restore. Preserve the failing logs, backup identifiers, migration version, and Storage inventory before retrying.
