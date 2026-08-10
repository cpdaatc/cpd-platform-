import { access, readFile, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function scanSecurityBoundary(root = process.cwd()) {
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
    const absolute = join(root, dir);
    if (!(await exists(absolute))) return [];
    const out = [];
    for (const entry of await readdir(absolute, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...await walk(path));
      else out.push(path);
    }
    return out;
  }

  if (!(await exists(join(root, 'SECURITY.md')))
    failures.push('SECURITY.md must document credential, disclosure, and production-release boundaries.');

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

  const scanFiles = [
    ...(await walk('src')),
    ...(await walk('scripts')),
    ...(await walk('supabase')),
  ].filter((path) => /\.(ts|tsx|js|jsx|mjs|sql|toml|json|env|example)$/.test(path));

  for (const path of scanFiles) {
    const source = await text(path);
    forbidPattern(source, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, `${path} contains a private key block.`);
    forbidPattern(source, /\bsb_secret_[A-Za-z0-9_-]{20,}\b/, `${path} contains a Supabase secret-key-shaped value.`);
    forbidPattern(source, /\bgh[opusr]_[A-Za-z0-9]{30,}\b/, `${path} contains a GitHub credential-shaped value.`);
    forbidPattern(source, /\bAKIA[0-9A-Z]{16}\b/, `${path} contains an AWS access-key-shaped value.`);
  }

  return failures;
}

async function main() {
  const failures = await scanSecurityBoundary(process.cwd());
  if (failures.length) {
    console.error('Production security release check failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }
  console.log('Production security release check passed.');
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedFile && currentFile === invokedFile) await main();
