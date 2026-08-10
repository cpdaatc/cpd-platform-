import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanSecurityBoundary } from '../../scripts/security-release-check.mjs';

async function fixture({ insecure = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'cpd-security-gate-'));
  await mkdir(join(root, 'src/lib/supabase'), { recursive: true });
  await mkdir(join(root, 'src/lib/storage'), { recursive: true });
  await mkdir(join(root, 'src/app/client'), { recursive: true });
  await mkdir(join(root, 'supabase/migrations'), { recursive: true });
  await mkdir(join(root, 'src/app/(app)/activities/[id]/intake'), { recursive: true });
  await mkdir(join(root, 'src/app/(app)/admin/references'), { recursive: true });
  await mkdir(join(root, 'src/app/(app)/admin/templates'), { recursive: true });

  await writeFile(join(root, 'SECURITY.md'), '# Security Policy\n');
  await writeFile(join(root, '.env.example'), 'SUPABASE_SERVICE_ROLE_KEY=replace-me\n');
  await writeFile(join(root, 'src/lib/supabase/admin.ts'), `import 'server-only';\nconst key=process.env.SUPABASE_SERVICE_ROLE_KEY;\nexport { key };\n`);
  await writeFile(join(root, 'src/lib/storage/private-documents.ts'), `import 'server-only';\nconst createSupabaseAdminClient=()=>null;\nconst prefix='x';\n'x'.startsWith(prefix);\nMath.min(Math.max(60,1),300);\nexport { createSupabaseAdminClient };\n`);
  await writeFile(join(root, 'supabase/migrations/0039_storage_role_boundary.sql'), 'drop policy if exists cpd_documents_select on storage.objects;\ndrop policy if exists cpd_documents_insert on storage.objects;\n');
  await writeFile(join(root, 'supabase/migrations/0018_ai_settings_governance.sql'), 'update x set external_ai_enabled = false;\n');
  for (const path of [
    'src/app/(app)/activities/[id]/intake/actions.ts',
    'src/app/(app)/activities/[id]/intake/file-actions.ts',
    'src/app/(app)/admin/references/actions.ts',
    'src/app/(app)/admin/templates/actions.ts',
  ]) {
    await writeFile(join(root, path), `import { uploadPrivateDocument } from '@/lib/storage/private-documents';\nvoid uploadPrivateDocument;\n`);
  }
  await writeFile(join(root, 'src/app/client/page.tsx'), insecure
    ? `'use client';\nconst leaked='SUPABASE_SERVICE_ROLE_KEY';\nexport default function Page(){return <div>{leaked}</div>}\n`
    : `'use client';\nexport default function Page(){return <div>safe</div>}\n`);
  return root;
}

describe('scanSecurityBoundary', () => {
  it('passes a repository that preserves server-only credential and private-storage boundaries', async () => {
    const root = await fixture();
    await expect(scanSecurityBoundary(root)).resolves.toEqual([]);
  });

  it('rejects client references to the service-role boundary', async () => {
    const root = await fixture({ insecure: true });
    const failures = await scanSecurityBoundary(root);
    expect(failures.join('\n')).toMatch(/Client module .*service-role|server-admin storage credentials/i);
  });

  it('rejects a missing repository security policy', async () => {
    const root = await fixture();
    const { rm } = await import('node:fs/promises');
    await rm(join(root, 'SECURITY.md'));
    const failures = await scanSecurityBoundary(root);
    expect(failures.join('\n')).toMatch(/SECURITY\.md/);
  });
});
