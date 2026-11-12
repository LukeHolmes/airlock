import { execFileSync } from 'node:child_process';

import { logEvent } from '../session/logger.js';
import { buildStaticTriageReport } from './normalize.js';
import {
  markTriageRunning,
  setTriageComplete,
  setTriageFailed,
} from './triageStore.js';
import type { TriageRawOutput } from './types.js';

const REPORT_PATH = '/tmp/airlock-triage.json';
const PROGRESS_PATH = '/tmp/airlock-triage.progress';
const TRIAGE_TIMEOUT_MS = 120_000;

function execCat(containerId: string, path: string): string | null {
  try {
    const out = execFileSync(
      'docker',
      ['exec', '-u', 'airlock', containerId, 'cat', path],
      { encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const text = out.trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Poll for in-container triage output (written by supervisord static-triage program).
 */
export async function awaitContainerTriageReport(
  sessionId: string,
  containerId: string,
): Promise<void> {
  markTriageRunning(sessionId);
  logEvent('TRIAGE_STARTED', { sessionId, containerId });

  const startedAt = Date.now();
  const deadline = startedAt + TRIAGE_TIMEOUT_MS;

  try {
    while (Date.now() < deadline) {
      const progress = execCat(containerId, PROGRESS_PATH);
      if (progress) {
        const line = progress.split('\n').pop();
        if (line) {
          logEvent('TRIAGE_PROGRESS', { sessionId, detail: line.slice(0, 200) });
        }
      }

      const rawText = execCat(containerId, REPORT_PATH);
      if (rawText) {
        const raw = JSON.parse(rawText) as TriageRawOutput;
        const report = buildStaticTriageReport(raw, {
          durationMs: Date.now() - startedAt,
          completedAt: new Date().toISOString(),
        });
        setTriageComplete(sessionId, report);
        logEvent('TRIAGE_COMPLETE', {
          sessionId,
          riskLevel: report.riskLevel,
          indicatorCount: report.indicators.length,
        });
        return;
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    setTriageFailed(sessionId, 'Static triage timed out waiting for container report');
    logEvent('TRIAGE_FAILED', { sessionId, error: 'timeout' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setTriageFailed(sessionId, message);
    logEvent('TRIAGE_FAILED', { sessionId, error: message });
  }
}
