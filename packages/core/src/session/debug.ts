export function debugLog(message: string, data?: unknown): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[AIRLOCK DEBUG] ${message}`, data ?? '');
  }
}
