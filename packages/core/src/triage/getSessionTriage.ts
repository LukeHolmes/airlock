import { getTriageSessionState, type TriageSessionState } from './triageStore.js';

export type SessionTriageSnapshot = {
  sessionId: string;
  state: TriageSessionState;
};

export function getSessionTriage(sessionId: string): SessionTriageSnapshot {
  return {
    sessionId,
    state: getTriageSessionState(sessionId) ?? { status: 'pending' },
  };
}
