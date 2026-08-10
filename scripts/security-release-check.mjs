import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const failures = [];

async function text(path) {
  return readFile(join(root, path), 'utf8');
}

function requirePattern(source, pattern, message) {
  if (!pattern.test(source)) failures.push(message);
}

function forbidPattern(source, pattern, message) {
  if (pattern.test(source)) failures.push(message);
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else out.push(path);
  }
  return out;
}

const adminClient = await text('src/lib/supabase/admin.ts');
requirePattern(adminClient, /import ['"]server-only['"]/, 'Supabase admin client must be server-only.');
requirePattern(adminClient, /SUPABASE_SERVICE_ROLE_KEY/, 'Server admin client must read the server-only service role key.');
forbidPattern(adminClient, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/, 'Service role key must never be public-prefixed.');

const privateStorage = await text('src/lib/storage/private-documents.ts');
requirePattern(privateStorage, /import ['"]server-only['"]/, 'Private document helper must be server-only.');
requirePattern(privateStorage, /createSupabaseAdminClient/, 'Private document helper must use the server admin client.');
requirePattern(privateStorage, /startsWith\(prefix\)/, 'Private document helper must enforce organization path boundaries.');
requirePattern(privateStorage, /Math\.min\(Math\.max/, 'Private signed URLs must have bounded lifetimes.');

const envExample = await text('.env.example');
forbidPattern(envExample, /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!server-only|replace|$)[^\n]+/i, 'Example environment file must not contain a real service-role secret.');

const sourceFiles = (await walk('src')).filter((path) => /\.(ts|tsx|js|jsx)$/.test(path));
for (const path of sourceFiles) {
  const source = await text(path);
  if (source.includes("'use client'") || source.includes('"use client"')) {
    forbidPattern(source, /SUPABASE_SERVICE_ROLE_KEY|createSupabaseAdminClient|private-documents/, `Client module ${relative(root, join(root, path))} references server-admin storage credentials.`);
  }
}

const storageMigration = await text('supabase/migrations/0039_storage_role_boundary.sql').catch(() => '');
requirePattern(storageMigration, /drop policy if exists cpd_documents_select/i, 'Authenticated direct document-read policy must be removed in a later migration.');
requirePattern(storageMigration, /drop policy if exists cpd_documents_insert/i, 'Authenticated direct document-write policy must be removed in a later migration.');

for (const path of [
  'src/app/(app)/activities/[id]/intake/actions.ts',
  'src/app/(app)/activities/[id]/intake/file-actions.ts',
  'src/app/(app)/admin/references/actions.ts',
  'src/app/(app)/admin/templates/actions.ts',
]) {
  const source = await text(path);
  requirePattern(source, /uploadPrivateDocument/, `${path} must use the server-only document helper for sensitive bytes.`);
  forbidPattern(source, /\.storage\.from\(['"]cpd-documents['"]\)/, `${path} must not access sensitive Storage bytes through the session client.`);
}

const aiGovernance = await text('supabase/migrations/0018_ai_settings_governance.sql');
requirePattern(aiGovernance, /external_ai_enabled\s*=\s*false/i, 'External AI must remain disabled by default until privacy approval.');

if (failures.length) {
  console.error('Production security release check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Production security release check passed.');
