import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';

export async function GET() {
  const bytes = await readFile(join(process.cwd(), 'public', 'brand', 'cpd-logo.png'));

  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
