import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SETUP_GUIDE_FILENAME = 'getting-started.md';

export function getSetupGuideCandidates(): string[] {
  const candidates: string[] = [];

  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, 'docs', SETUP_GUIDE_FILENAME));
  }

  candidates.push(
    path.resolve(process.cwd(), 'docs', SETUP_GUIDE_FILENAME),
    path.resolve(__dirname, '../../../../../docs', SETUP_GUIDE_FILENAME),
  );

  return candidates;
}

export function resolveSetupGuidePath(): string | null {
  for (const candidate of getSetupGuideCandidates()) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}
