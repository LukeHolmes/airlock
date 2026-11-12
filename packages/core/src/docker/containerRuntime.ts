import { execSync } from 'node:child_process';

export const AIRLOCK_CONTAINER_RUNTIME_ENV = 'AIRLOCK_RUNTIME';

/**
 * Returns `runsc` only when explicitly requested and registered with Docker.
 * Default: undefined (runc via Docker default).
 */
export function resolveOptionalContainerRuntime(): string | undefined {
  const requested = process.env[AIRLOCK_CONTAINER_RUNTIME_ENV]?.trim().toLowerCase();
  if (requested !== 'runsc') {
    return undefined;
  }

  try {
    const output = execSync("docker info -f '{{json .Runtimes}}'", {
      encoding: 'utf8',
      timeout: 3000,
    });
    const runtimes = JSON.parse(output) as Record<string, { path?: string }>;
    if (runtimes && Object.prototype.hasOwnProperty.call(runtimes, 'runsc')) {
      return 'runsc';
    }
  } catch {
    // Docker unavailable or runsc not registered — fall back to default runtime
  }

  return undefined;
}
