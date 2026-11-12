import { execFileSync } from 'node:child_process';
import path from 'node:path';

export const CONTAINER_INPUT_DIR = '/home/airlock/workspace/input';
export const FLATTEN_SCRIPT_PATH = '/usr/local/bin/airlock-flatten-pdf';
export const FLATTEN_OUTPUT_PATH = '/tmp/airlock-flattened.pdf';

/** Dangerous PDF markers that pixel-flatten should remove from the byte stream. */
const PDF_ACTIVE_MARKERS = [/\/JavaScript/i, /\/JS\s/i, /\/OpenAction/i, /\/AA\s/i];

export function containerTargetPathForHostFile(hostFilePath: string): string {
  const ext = path.extname(hostFilePath).toLowerCase() || '';
  return `${CONTAINER_INPUT_DIR}/target${ext}`;
}

export function assertFlattenedPdfBytes(pdf: Buffer): void {
  const text = pdf.toString('latin1');
  for (const pattern of PDF_ACTIVE_MARKERS) {
    if (pattern.test(text)) {
      throw new Error(`Flattened PDF still contains active-content marker: ${pattern}`);
    }
  }
  if (!text.startsWith('%PDF-')) {
    throw new Error('Flattened output is not a PDF header');
  }
}

export function flattenPdfInContainer(containerId: string, containerInputPdf: string): Buffer {
  execFileSync(
    'docker',
    [
      'exec',
      '-u',
      'airlock',
      containerId,
      FLATTEN_SCRIPT_PATH,
      containerInputPdf,
      FLATTEN_OUTPUT_PATH,
    ],
    { stdio: 'pipe', timeout: 120_000 },
  );

  const pdf = execFileSync(
    'docker',
    ['exec', '-u', 'airlock', containerId, 'cat', FLATTEN_OUTPUT_PATH],
    { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, timeout: 60_000 },
  );

  assertFlattenedPdfBytes(pdf);
  return pdf;
}
