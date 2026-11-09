import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';

import { validateDrop } from '../validation/validateDrop.js';
import type { SessionArtefacts } from './artefacts.js';
import type { SessionExportFileFingerprint, SessionExportUrlFingerprint } from './sessionExport.js';

async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export async function resolveSessionInputFingerprint(
  artefacts: SessionArtefacts,
): Promise<SessionExportFileFingerprint | SessionExportUrlFingerprint | undefined> {
  if (artefacts.input.type === 'url') {
    return { url: artefacts.input.value };
  }

  const filePath = artefacts.input.value;
  if (!filePath) {
    return undefined;
  }

  const drop = validateDrop(filePath);
  if (!drop.ok) {
    return undefined;
  }

  const sha256 = await sha256File(filePath);

  return {
    fileName: basename(filePath),
    sizeBytes: drop.sizeBytes,
    mimeType: drop.mimeType,
    extension: drop.extension,
    sha256,
  };
}
