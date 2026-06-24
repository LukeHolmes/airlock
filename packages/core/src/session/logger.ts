const sessionLogs = new Map<
  string,
  Array<{
    ts: number;
    event: string;
    payload?: Record<string, unknown>;
  }>
>();

export function getSessionLogs(
  sessionId: string,
): Array<{
  ts: number;
  event: string;
  payload?: Record<string, unknown>;
}> {
  return sessionLogs.get(sessionId) ?? [];
}

export function logEvent(event: string, payload?: Record<string, unknown>): void {
  const ts = Date.now();
  const entry = { ts, event, payload };

  console.log(
    JSON.stringify({
      ts,
      event,
      ...payload,
    }),
  );

  const sessionId = payload?.sessionId;
  if (typeof sessionId === 'string') {
    const logs = sessionLogs.get(sessionId) ?? [];
    logs.push(entry);
    sessionLogs.set(sessionId, logs);
  }
}
