#!/usr/bin/env node
/**
 * Fail CI if OpenClaw reference trees or plugin-sdk dependencies reappear.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const errors = [];

for (const rel of [
  'packages/core/src/_ref',
  'packages/ui/src/_ref',
  'docs/ref-import-audit.txt',
]) {
  const path = join(root, rel);
  if (existsSync(path)) {
    errors.push(`found forbidden path: ${rel}`);
  }
}

try {
  const hits = execSync(
    `rg -i 'openclaw|plugin-sdk' --glob '!node_modules' --glob '!pnpm-lock.yaml' --glob '!**/seccomp/airlock.profile.json' .`,
    { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();
  if (hits) {
    const allowed = hits
      .split('\n')
      .filter((line) => !line.includes('THIRD_PARTY_LICENSES.md'))
      .filter((line) => !line.includes('check-openclaw-leftovers.mjs'))
      .filter((line) => !/Design inspired by OpenClaw/i.test(line))
      .filter((line) => !/design inspiration only/i.test(line));
    if (allowed.length > 0) {
      errors.push(`unexpected openclaw/plugin-sdk references:\\n${allowed.join('\\n')}`);
    }
  }
} catch (error) {
  if (error.status !== 1) {
    throw error;
  }
}

try {
  const danger = execSync(
    `rg -i 'derived from dangerzone' --glob '!node_modules' --glob '!scripts/check-openclaw-leftovers.mjs' .`,
    { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();
  if (danger) {
    errors.push(`Dangerzone attribution must be removed:\\n${danger}`);
  }
} catch (error) {
  if (error.status !== 1) {
    throw error;
  }
}

if (errors.length > 0) {
  console.error('OpenClaw / licensing guard failed:');
  for (const message of errors) console.error(`- ${message}`);
  process.exit(1);
}

console.log('OpenClaw leftovers check: OK');
