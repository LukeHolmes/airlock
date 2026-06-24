export function logEvent(event: string, payload?: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      ts: Date.now(),
      event,
      ...payload,
    }),
  );
}
