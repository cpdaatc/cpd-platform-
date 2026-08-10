import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const cli = resolve('scripts/security-release-check.mjs');

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
    ? `'use client';\nconst leaked='SUPABASE_SERVICE_ROLE_KEY';\nexport default function Page(){return leaked}\n`
    : `'use client';\nexport default function Page(){return 'safe'}\n`);
  return root;
}

async function run(root) {
  try {
    const result = await execFileAsync(process.execPath, [cli], {
      env: { ...process.env, SECURITY_SCAN_ROOT: root },
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      code: Number(error.code ?? 1),
      stdout: String(error.stdout ?? ''),
      stderr: String(error.stderr ?? error.message ?? ''),
    };
  }
}

describe('security release CLI', () => {
  it('passes a repository that preserves server-only credential and private-storage boundaries', async () => {
    const root = await fixture();
    const result = await run(root);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/passed/i);
  });

  it('rejects client references to the service-role boundary', async () => {
    const root = await fixture({ insecure: true });
    const result = await run(root);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(/Client module .*server-admin storage credentials/i);
  });

  it('rejects a missing repository security policy', async () => {
    const root = await fixture();
    await rm(join(root, 'SECURITY.md'));
    const result = await run(root);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(/SECURITY\.md/);
  });
});
