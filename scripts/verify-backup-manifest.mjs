import fs from 'node:fs';
import { validateBackupManifest } from './verify-backup-manifest-lib.mjs';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/verify-backup-manifest.mjs <manifest.json>');
  process.exit(2);
}

let manifest;
try { manifest = JSON.parse(fs.readFileSync(path, 'utf8')); }
catch { console.error('Backup manifest could not be read as JSON.'); process.exit(2); }

const result = validateBackupManifest(manifest);
if (!result.ok) {
  console.error(`Backup manifest invalid: ${result.errors.join('; ')}`);
  process.exit(1);
}
console.log('Backup manifest integrity contract: PASS');
