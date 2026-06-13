#!/usr/bin/env node
/**
 * Integration smoke test via @airlock/core ContainerManager.
 * Run after: pnpm build && pnpm sandbox:build
 */
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { docker } from '@airlock/core';

const testPdf = join(tmpdir(), `airlock-core-smoke-${process.pid}.pdf`);
writeFileSync(testPdf, '%PDF-1.4\n% Airlock core smoke test\n');

try {
  console.log('[core-smoke] Creating file container...');
  const session = await docker.createFileContainer(testPdf, {
    name: `airlock-smoke-${Date.now()}`,
  });

  if (!session.vncUrl || !session.vncPageUrl) {
    throw new Error(`Missing VNC URLs: ${JSON.stringify(session)}`);
  }

  console.log(`[core-smoke] vncUrl=${session.vncUrl}`);

  const page = await fetch(session.vncPageUrl);
  if (!page.ok) {
    throw new Error(`vnc.html returned ${page.status}`);
  }
  console.log('[core-smoke] vnc.html reachable');

  await docker.destroyContainer(session.id);
  console.log('[core-smoke] Container destroyed');
  console.log('[core-smoke] PASS');
} finally {
  try {
    unlinkSync(testPdf);
  } catch {
    // ignore
  }
}
