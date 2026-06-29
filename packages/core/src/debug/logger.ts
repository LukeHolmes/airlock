export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export type DebugPhase = 'create' | 'start' | 'vnc' | 'destroy';

export interface DebugLogContext {
  sessionId?: string;
  containerId?: string;
  port?: number | string;
  eventName?: string;
  phase?: DebugPhase;
  [key: string]: unknown;
}

function serializeContext(context?: DebugLogContext): string {
  if (!context) {
    return '';
  }

  try {
    const entries = Object.entries(context).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      return '';
    }

    return ` | ${JSON.stringify(Object.fromEntries(entries))}`;
  } catch {
    return ' | {}';
  }
}

export function log(level: LogLevel, message: string, context?: DebugLogContext): void {
  const timestamp = new Date().toISOString();
  const line = `[AIRLOCK][${timestamp}][${level}] ${message}${serializeContext(context)}`;

  switch (level) {
    case 'ERROR':
      console.error(line);
      break;
    case 'WARN':
      console.warn(line);
      break;
    default:
      console.log(line);
      break;
  }
}
