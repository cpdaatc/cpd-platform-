import { describe, expect, it } from 'vitest';
import { validateBackupManifest } from '../../scripts/verify-backup-manifest-lib.mjs';

const valid = {
  version: 1,
  createdAt: '2026-08-10T20:00:00.000Z',
  database: { sha256: 'a'.repeat(64), bytes: 1024 },
  storage: { objectCount: 0, inventorySha256: 'b'.repeat(64) },
};

describe('backup manifest validator', () => {
  it('accepts a complete integrity manifest', () => {
    expect(validateBackupManifest(valid)).toEqual({ ok: true, errors: [] });
  });

  it.each([
    [{ ...valid, version: 2 }, 'version'],
    [{ ...valid, database: { ...valid.database, sha256: 'bad' } }, 'database.sha256'],
    [{ ...valid, database: { ...valid.database, bytes: 0 } }, 'database.bytes'],
    [{ ...valid, storage: { ...valid.storage, objectCount: -1 } }, 'storage.objectCount'],
    [{ ...valid, storage: { ...valid.storage, inventorySha256: 'bad' } }, 'storage.inventorySha256'],
  ])('rejects malformed or incomplete manifest %#', (manifest, errorFragment) => {
    const result = validateBackupManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain(errorFragment);
  });
});
