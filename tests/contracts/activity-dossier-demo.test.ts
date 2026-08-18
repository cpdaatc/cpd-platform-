import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('full platform and Cloudflare dossier parity', () => {
  it('uses a versioned, visibly synthetic demo dossier contract', async () => {
    const fixture = await readFile(join(process.cwd(), 'demo', 'activity-dossiers.synthetic.js'), 'utf8');
    expect(fixture).toContain('contractVersion: 1');
    expect(fixture).toContain('assignedOfficerId');
    for (const category of ['OFFICIAL_FORM','COMMITTEE_DECISION','COMMITTEE_MINUTES','FINAL_IMPACT_REPORT','ADDITIONAL_ATTACHMENT']) {
      expect(fixture).toContain(`category: '${category}'`);
    }
  });

  it('keeps all six source-rendered Letter pages byte-identical in both surfaces', async () => {
    for (let page = 1; page <= 6; page += 1) {
      const [full, demo] = await Promise.all([
        readFile(join(process.cwd(), 'public', 'templates', 'schs-activity-application-v1', `page-${page}.png`)),
        readFile(join(process.cwd(), 'demo', 'templates', 'schs-activity-application-v1', `page-${page}.png`)),
      ]);
      const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');
      expect(hash(demo)).toBe(hash(full));
      expect(full.length).toBeGreaterThan(25_000);
    }
  });
});
