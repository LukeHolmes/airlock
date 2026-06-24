import { getSessionLogs } from './logger.js';
import type { AirlockSession } from './types.js';

export type SessionArtefacts = {
  sessionId: string;
  input: {
    type: 'file' | 'url';
    value: string;
  };
  metadata: AirlockSession['metadata'];
  logs: Array<{
    ts: number;
    event: string;
    payload?: Record<string, unknown>;
  }>;
};

type SessionRecord = {
  input: SessionArtefacts['input'];
  metadata: AirlockSession['metadata'];
};

const sessionRegistry = new Map<string, SessionRecord>();

export function registerSessionRecord(
  sessionId: string,
  input: SessionArtefacts['input'],
  metadata: AirlockSession['metadata'],
): void {
  sessionRegistry.set(sessionId, { input, metadata });
}

export function updateSessionRecord(
  sessionId: string,
  metadata: AirlockSession['metadata'],
): void {
  const existing = sessionRegistry.get(sessionId);
  if (existing) {
    sessionRegistry.set(sessionId, { ...existing, metadata });
  }
}

export function getSessionArtefacts(sessionId: string): SessionArtefacts {
  const record = sessionRegistry.get(sessionId);
  const logs = getSessionLogs(sessionId);

  return {
    sessionId,
    input: record?.input ?? { type: 'file', value: '' },
    metadata: record?.metadata ?? {
      startTime: 0,
      inputType: 'file',
      networkMode: 'isolated',
    },
    logs,
  };
}
