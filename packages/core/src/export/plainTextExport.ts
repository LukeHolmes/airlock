import { execFileSync } from 'node:child_process';
import { containerTargetPathForHostFile } from './flattenedPdf.js';
import { normalizeExportedPlainText, type NormalizePlainTextResult } from './scrubPlainText.js';

export { containerTargetPathForHostFile };
export { isPlainTextExportSupported } from './plainTextExportSupport.js';

export const EXTRACT_SCRIPT_PATH = '/usr/local/bin/airlock-extract-plaintext';
export const EXTRACT_OUTPUT_PATH = '/tmp/airlock-plain.txt';

export type PlainTextExtractResult = NormalizePlainTextResult & {
  rawByteLength: number;
};

export function extractPlainTextInContainer(
  containerId: string,
  containerInputPath: string,
): PlainTextExtractResult {
  execFileSync(
    'docker',
    [
      'exec',
      '-u',
      'airlock',
      containerId,
      EXTRACT_SCRIPT_PATH,
      containerInputPath,
      EXTRACT_OUTPUT_PATH,
    ],
    { stdio: 'pipe', timeout: 180_000 },
  );

  const raw = execFileSync(
    'docker',
    ['exec', '-u', 'airlock', containerId, 'cat', EXTRACT_OUTPUT_PATH],
    {
      encoding: 'buffer',
      maxBuffer: 2 * 1024 * 1024 + 64 * 1024,
      timeout: 60_000,
    },
  );

  const normalized = normalizeExportedPlainText(raw);
  return { ...normalized, rawByteLength: raw.length };
}
