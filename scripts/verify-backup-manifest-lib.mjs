const sha256Pattern = /^[0-9a-f]{64}$/i;

export function validateBackupManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return { ok: false, errors: ['manifest must be an object'] };
  if (manifest.version !== 1) errors.push('version must equal 1');
  if (typeof manifest.createdAt !== 'string' || Number.isNaN(Date.parse(manifest.createdAt))) errors.push('createdAt must be an ISO timestamp');
  if (!manifest.database || typeof manifest.database !== 'object') errors.push('database section is required');
  else {
    if (!sha256Pattern.test(String(manifest.database.sha256 ?? ''))) errors.push('database.sha256 must be a SHA-256 hex digest');
    if (!Number.isInteger(manifest.database.bytes) || manifest.database.bytes <= 0) errors.push('database.bytes must be a positive integer');
  }
  if (!manifest.storage || typeof manifest.storage !== 'object') errors.push('storage section is required');
  else {
    if (!Number.isInteger(manifest.storage.objectCount) || manifest.storage.objectCount < 0) errors.push('storage.objectCount must be a non-negative integer');
    if (!sha256Pattern.test(String(manifest.storage.inventorySha256 ?? ''))) errors.push('storage.inventorySha256 must be a SHA-256 hex digest');
  }
  return { ok: errors.length === 0, errors };
}
