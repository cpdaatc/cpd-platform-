import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';

export async function GET() {
  const source = await readFile(join(process.cwd(), 'public', 'brand', 'cpd-logo.txt'), 'utf8');
  const bytes = Buffer.from(source.trim(), 'base64');

  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
