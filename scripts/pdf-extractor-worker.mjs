import { parentPort, workerData } from 'node:worker_threads';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const MAX_PAGES = 100;
const MAX_TEXT_ITEMS = 100_000;
const MAX_TEXT_CHARACTERS = 500_000;

async function run() {
  const data = workerData?.data;
  if (!(data instanceof Uint8Array)) throw new Error('PDF worker received invalid bytes.');
  const loadingTask = pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: false });
  const document = await loadingTask.promise;
  try {
    if (document.numPages < 1 || document.numPages > MAX_PAGES) {
      throw new Error(`PDF page count exceeds the ${MAX_PAGES}-page boundary.`);
    }
    const pages = [];
    let totalItems = 0;
    let totalCharacters = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      totalItems += textContent.items.length;
      if (totalItems > MAX_TEXT_ITEMS) throw new Error('PDF text-item boundary exceeded.');
      const text = textContent.items.map((item) => ('str' in item ? item.str : '')).filter(Boolean).join('\n');
      totalCharacters += text.length;
      if (totalCharacters > MAX_TEXT_CHARACTERS) throw new Error('PDF extracted-text boundary exceeded.');
      pages.push({ pageNumber, text });
      page.cleanup();
    }
    return pages;
  } finally {
    await document.destroy();
  }
}

run()
  .then((pages) => parentPort?.postMessage({ ok: true, pages }))
  .catch((error) => parentPort?.postMessage({ ok: false, error: error instanceof Error ? error.message : 'PDF extraction failed.' }));
