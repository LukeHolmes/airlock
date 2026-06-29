import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';

export type ContainerRuntime = 'podman' | 'docker';

export interface RuntimeSocket {
  runtime: ContainerRuntime;
  socketPath: string;
}

export class RuntimeNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeNotFoundError';
  }
}

export function detectRuntimeSocket(): RuntimeSocket {
  const uid = process.getuid?.() ?? 1000;
  const home = os.homedir();

  const candidates: Array<{ runtime: ContainerRuntime; socketPath: string }> = [
    {
      runtime: 'podman',
      socketPath: `${home}/.local/share/containers/podman/machine/podman.sock`,
    },
    {
      runtime: 'podman',
      socketPath: `${home}/.local/share/containers/podman/machine/qemu/podman.sock`,
    },
    {
      runtime: 'podman',
      socketPath: `/run/user/${uid}/podman/podman.sock`,
    },
    {
      runtime: 'podman',
      socketPath: `/tmp/podman-run-${uid}/podman/podman.sock`,
    },
    {
      runtime: 'docker',
      socketPath: '/var/run/docker.sock',
    },
    {
      runtime: 'docker',
      socketPath: `${home}/.docker/run/docker.sock`,
    },
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate.socketPath)) {
      process.stderr.write(
        `[airlock:runtime] detected ${candidate.runtime} at ${candidate.socketPath}\n`,
      );
      return candidate;
    }
  }

  throw new RuntimeNotFoundError(
    'AIRLOCK_NO_RUNTIME: No container runtime found. ' +
      'Install Podman from podman.io or ensure Docker Desktop is running.',
  );
}

export function detectRuntimeBinary(): string {
  const isWindows = process.platform === 'win32';

  const hasPodman = (): boolean => {
    try {
      if (isWindows) {
        execSync('where podman', { stdio: 'ignore' });
      } else {
        execSync('which podman', { stdio: 'ignore' });
      }
      return true;
    } catch {
      return false;
    }
  };

  const hasDocker = (): boolean => {
    try {
      if (isWindows) {
        execSync('where docker', { stdio: 'ignore' });
      } else {
        execSync('which docker', { stdio: 'ignore' });
      }
      return true;
    } catch {
      return false;
    }
  };

  if (hasPodman()) {
    return 'podman';
  }

  if (hasDocker()) {
    return 'docker';
  }

  throw new RuntimeNotFoundError(
    'AIRLOCK_NO_RUNTIME_BINARY: Neither podman nor docker found in PATH. ' +
      'Install Podman from podman.io.',
  );
}
