import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import type { ExtractedPageText } from './pdf-extractor';

export const MAX_PDF_UPLOAD_BYTES = 10 * 1024 * 1024;
const PDF_EXTRACTION_TIMEOUT_MS = 12_000;

export function validatePdfEnvelope(data: Uint8Array): void {
  if (data.byteLength === 0 || data.byteLength > MAX_PDF_UPLOAD_BYTES) {
    throw new Error('PDF size is outside the extraction boundary.');
  }
  const header = new TextDecoder('ascii').decode(data.subarray(0, Math.min(data.byteLength, 1024)));
  if (!header.includes('%PDF-')) throw new Error('Missing PDF signature.');
}

export async function extractNativePdfTextIsolated(data: Uint8Array): Promise<ExtractedPageText[]> {
  validatePdfEnvelope(data);
  const copy = Uint8Array.from(data);
  const workerPath = join(process.cwd(), 'scripts', 'pdf-extractor-worker.mjs');
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, {
      workerData: { data: copy },
      transferList: [copy.buffer],
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const timeout = setTimeout(() => {
      finish(() => {
        void worker.terminate();
        reject(new Error('PDF extraction exceeded the execution-time boundary.'));
      });
    }, PDF_EXTRACTION_TIMEOUT_MS);
    worker.once('message', (message: { ok: boolean; pages?: ExtractedPageText[]; error?: string }) => {
      finish(() => {
        void worker.terminate();
        if (!message.ok || !message.pages) reject(new Error(message.error ?? 'PDF extraction failed.'));
        else resolve(message.pages);
      });
    });
    worker.once('error', (error) => finish(() => reject(error)));
    worker.once('exit', (code) => {
      if (code !== 0) finish(() => reject(new Error(`PDF extraction worker exited with code ${code}.`)));
    });
  });
}
