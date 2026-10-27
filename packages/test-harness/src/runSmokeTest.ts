import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { docker } from '@airlock/core';

import {
  checkContainerExists,
  cleanupStaleAirlockContainers,
  getMappedPort,
  listAirlockContainers,
  waitForContainerRunning,
  waitForVnc,
} from './utils.js';

const TIMEOUT_MS = 15000;

type StepResult = {
  label: string;
  passed: boolean;
  detail?: string;
};

function printHeader(): void {
  console.log('');
  console.log('=========================');
  console.log('AIRLOCK SMOKE TEST RESULT');
  console.log('=========================');
  console.log('');
}

function printStep(step: StepResult): void {
  const icon = step.passed ? '✅' : '❌';
  const suffix = step.detail ? `: ${step.detail}` : '';
  console.log(`${icon} ${step.label}${suffix}`);
}

async function main(): Promise<number> {
  const steps: StepResult[] = [];
  const testPdf = join(tmpdir(), `airlock-smoke-${process.pid}.pdf`);
  let sessionId: string | undefined;
  let containerId: string | undefined;
  let mappedPort: number | null = null;

  try {
    const removed = await cleanupStaleAirlockContainers();
    if (removed > 0) {
      console.log(`[harness] Removed ${removed} stale Airlock container(s) before test`);
    }

    writeFileSync(testPdf, '%PDF-1.4\n%Airlock smoke test\n');

    const session = await docker.createFileContainer(testPdf, {
      name: `airlock-smoke-${Date.now()}`,
    });

    sessionId = session.id;
    containerId = session.id;
    mappedPort = await getMappedPort(session.id);

    const created = Boolean(session.id) && (await checkContainerExists(session.id));
    steps.push({
      label: 'Container created',
      passed: created,
      detail: created ? session.id.slice(0, 12) : undefined,
    });

    if (!created) {
      printHeader();
      for (const step of steps) {
        printStep(step);
      }
      console.log('');
      console.log('RESULT: FAIL');
      return 1;
    }

    const running = await waitForContainerRunning(session.id, TIMEOUT_MS);
    if (!running) {
      steps.push({ label: 'Container running', passed: false });
    }

    if (!mappedPort) {
      mappedPort = await getMappedPort(session.id);
    }

    steps.push({
      label: 'Port mapped',
      passed: mappedPort !== null,
      detail: mappedPort !== null ? String(mappedPort) : undefined,
    });

    const vncReachable =
      mappedPort !== null ? await waitForVnc(mappedPort, TIMEOUT_MS) : false;

    steps.push({
      label: 'VNC reachable',
      passed: vncReachable,
      detail: mappedPort !== null ? `http://127.0.0.1:${mappedPort}` : undefined,
    });

    if (!vncReachable) {
      printHeader();
      for (const step of steps) {
        printStep(step);
      }
      console.log('');
      console.log('RESULT: FAIL');
      return 1;
    }

    await docker.destroyContainer(session.id);

    const destroyed = !(await checkContainerExists(session.id));
    steps.push({
      label: 'Container destroyed',
      passed: destroyed,
    });

    const orphans = await listAirlockContainers();
    steps.push({
      label: 'No orphan containers',
      passed: orphans.length === 0,
      detail: orphans.length > 0 ? `${orphans.length} remaining` : undefined,
    });

    const passed = steps.every((step) => step.passed);

    printHeader();
    for (const step of steps) {
      printStep(step);
    }
    console.log('');
    console.log(`RESULT: ${passed ? 'PASS' : 'FAIL'}`);
    console.log('');

    return passed ? 0 : 1;
  } catch (error) {
    if (containerId) {
      try {
        await docker.destroyContainer(containerId);
      } catch {
        // best-effort cleanup
      }
    }

    printHeader();
    for (const step of steps) {
      printStep(step);
    }

    printStep({
      label: 'Smoke test execution',
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    });

    console.log('');
    console.log('RESULT: FAIL');
    console.log('');

    if (sessionId || containerId) {
      console.log(
        `[harness] sessionId=${sessionId ?? 'n/a'} containerId=${containerId ?? 'n/a'} port=${mappedPort ?? 'n/a'}`,
      );
    }

    return 1;
  } finally {
    try {
      unlinkSync(testPdf);
    } catch {
      // ignore temp file cleanup errors
    }
  }
}

const exitCode = await main();
process.exit(exitCode);
