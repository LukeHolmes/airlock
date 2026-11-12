import type { StaticTriageReport } from './types.js';

export type TriageSessionState =
  | { status: 'pending' }
  | { status: 'running'; startedAt: number }
  | { status: 'complete'; report: StaticTriageReport }
  | { status: 'failed'; error: string };

const triageBySession = new Map<string, TriageSessionState>();

export function initTriageSession(sessionId: string): void {
  triageBySession.set(sessionId, { status: 'pending' });
}

export function markTriageRunning(sessionId: string): void {
  triageBySession.set(sessionId, { status: 'running', startedAt: Date.now() });
}

export function setTriageComplete(sessionId: string, report: StaticTriageReport): void {
  triageBySession.set(sessionId, { status: 'complete', report });
}

export function setTriageFailed(sessionId: string, error: string): void {
  triageBySession.set(sessionId, { status: 'failed', error });
}

export function getTriageSessionState(sessionId: string): TriageSessionState | undefined {
  return triageBySession.get(sessionId);
}

export function clearTriageSession(sessionId: string): void {
  triageBySession.delete(sessionId);
}
