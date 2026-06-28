import { app } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isSandboxBuildContext, resolveSandboxContextFromCandidates } from '@airlock/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getSandboxContextCandidates(): string[] {
  const candidates: string[] = [];

  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, 'sandbox'));
  }

  candidates.push(
    path.resolve(__dirname, '../../../../sandbox'),
    path.resolve(__dirname, '../../../../../packages/sandbox'),
    path.resolve(process.cwd(), 'packages/sandbox'),
  );

  return candidates;
}

export function getSandboxBuildContextPath(): string | null {
  return resolveSandboxContextFromCandidates(getSandboxContextCandidates());
}

export function hasPackagedSandboxContext(): boolean {
  if (!app.isPackaged) {
    return false;
  }

  const packagedPath = path.join(process.resourcesPath, 'sandbox');
  return isSandboxBuildContext(packagedPath);
}
