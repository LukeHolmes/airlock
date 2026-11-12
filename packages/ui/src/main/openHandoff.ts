import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Resolve a local file path from argv, shell open-file events, or airlock:// URLs.
 */
export function resolveOpenTarget(candidate: string): string | undefined {
  const trimmed = candidate.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith('airlock://')) {
    return parseAirlockUrl(trimmed);
  }

  if (trimmed.startsWith('file://')) {
    try {
      const decoded = decodeURIComponent(new URL(trimmed).pathname);
      if (process.platform === 'win32' && decoded.startsWith('/')) {
        return decoded.slice(1);
      }
      return decoded;
    } catch {
      return undefined;
    }
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const resolved = path.resolve(trimmed);
  return existsSync(resolved) ? resolved : undefined;
}

export function parseAirlockUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'airlock:') {
      return undefined;
    }

    const hostPath = parsed.host ? `/${parsed.host}${parsed.pathname}` : parsed.pathname;
    const fromPath = hostPath && hostPath !== '/' ? decodeURIComponent(hostPath) : undefined;
    const fromQuery =
      parsed.searchParams.get('path') ??
      parsed.searchParams.get('file') ??
      parsed.searchParams.get('url') ??
      undefined;

    const raw = fromQuery ?? fromPath;
    if (!raw) {
      return undefined;
    }

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }

    const filePath = path.isAbsolute(raw) ? raw : path.resolve(raw);
    return existsSync(filePath) ? filePath : raw;
  } catch {
    return undefined;
  }
}

export function pickOpenTargetFromArgv(argv: string[]): string | undefined {
  const ignoredSuffixes = ['electron', 'airlock', 'Airlock'];

  for (const arg of [...argv].reverse()) {
    if (!arg || arg.startsWith('-') || arg === '.') {
      continue;
    }
    if (arg.includes('node_modules/electron') || arg.includes('/.pnpm/')) {
      continue;
    }
    if (ignoredSuffixes.some((suffix) => arg.endsWith(suffix))) {
      continue;
    }
    if (arg.startsWith('airlock://')) {
      const resolved = parseAirlockUrl(arg);
      if (resolved) {
        return resolved;
      }
    }
    const resolved = resolveOpenTarget(arg);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}
