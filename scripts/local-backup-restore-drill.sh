#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

workdir="${1:-/tmp/cpd-backup-restore-drill}"
rm -rf "$workdir"
mkdir -p "$workdir"
dump_file="$workdir/cpd-test.dump"
inventory_file="$workdir/storage-inventory.json"
manifest_file="$workdir/backup-manifest.json"
restore_url="${DATABASE_URL%/*}/cpd_restore"

pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" --file "$dump_file"
test -s "$dump_file"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "drop database if exists cpd_restore with (force);"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "create database cpd_restore;"
pg_restore --no-owner --no-acl --dbname "$restore_url" "$dump_file"

for table in organizations users activities audit_logs institutional_committees committee_minutes impact_reports annual_committee_reports; do
  restored=$(psql "$restore_url" -Atc "select to_regclass('public.${table}') is not null")
  test "$restored" = "t" || { echo "Missing restored table: $table" >&2; exit 1; }
done

source_orgs=$(psql "$DATABASE_URL" -Atc 'select count(*) from public.organizations')
restored_orgs=$(psql "$restore_url" -Atc 'select count(*) from public.organizations')
test "$source_orgs" = "$restored_orgs" || { echo 'Organization row count mismatch after restore' >&2; exit 1; }

source_audit=$(psql "$DATABASE_URL" -Atc 'select count(*) from public.audit_logs')
restored_audit=$(psql "$restore_url" -Atc 'select count(*) from public.audit_logs')
test "$source_audit" = "$restored_audit" || { echo 'Audit row count mismatch after restore' >&2; exit 1; }

printf '[]\n' > "$inventory_file"
db_sha=$(sha256sum "$dump_file" | awk '{print $1}')
db_bytes=$(stat -c '%s' "$dump_file")
storage_sha=$(sha256sum "$inventory_file" | awk '{print $1}')
created_at=$(date -u +'%Y-%m-%dT%H:%M:%S.000Z')

cat > "$manifest_file" <<JSON
{
  "version": 1,
  "createdAt": "$created_at",
  "database": { "sha256": "$db_sha", "bytes": $db_bytes },
  "storage": { "objectCount": 0, "inventorySha256": "$storage_sha" }
}
JSON

node scripts/verify-backup-manifest.mjs "$manifest_file"
echo "Backup/restore drill: PASS (organizations=$restored_orgs, audit_events=$restored_audit)"
