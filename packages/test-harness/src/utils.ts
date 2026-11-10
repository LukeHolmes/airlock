import { execSync } from 'node:child_process';

import { docker } from '@airlock/core';
import Dockerode from 'dockerode';

const VNC_CONTAINER_PORT = '6901/tcp';

let dockerClient: Dockerode | undefined;

function getDocker(): Dockerode {
  if (!dockerClient) {
    dockerClient = new Dockerode();
  }
  return dockerClient;
}

export async function checkContainerExists(id: string): Promise<boolean> {
  const docker = getDocker();
  const container = docker.getContainer(id);

  try {
    await container.inspect();
    return true;
  } catch {
    return false;
  }
}

export async function getContainerState(id: string): Promise<string | null> {
  const docker = getDocker();
  const container = docker.getContainer(id);

  try {
    const info = await container.inspect();
    return info.State.Status;
  } catch {
    return null;
  }
}

export async function getMappedPort(containerId: string): Promise<number | null> {
  const docker = getDocker();
  const container = docker.getContainer(containerId);

  try {
    const info = await container.inspect();
    const hostPort = info.NetworkSettings.Ports?.[VNC_CONTAINER_PORT]?.[0]?.HostPort;
    if (!hostPort) {
      return null;
    }

    const port = Number(hostPort);
    return Number.isFinite(port) ? port : null;
  } catch {
    return null;
  }
}

/** Matches the HTTP/HTTPS probe used in `.github/workflows/ci.yml` docker job. */
function probeVncHttp(port: number): boolean {
  try {
    execSync(`curl -sf http://127.0.0.1:${port}/ >/dev/null`, { stdio: 'ignore' });
    return true;
  } catch {
    try {
      execSync(`curl -skf https://127.0.0.1:${port}/ >/dev/null`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

export async function waitForVnc(port: number, timeoutMs = 90000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (probeVncHttp(port)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  return false;
}

export async function listAirlockContainers(): Promise<
  Array<{ id: string; name: string; state: string }>
> {
  const client = getDocker();
  const containers = await docker.listManagedAirlockContainers(client);
  return containers.map((container) => ({
    id: container.id,
    name: container.name,
    state: container.state,
  }));
}

export async function cleanupStaleAirlockContainers(): Promise<number> {
  const client = getDocker();
  const result = await docker.reclaimStaleManagedContainers(client, process.pid);
  return result.destroyed.length;
}

export async function listAirlockContainersWithRetry(
  attempts = 5,
  delayMs = 400,
): Promise<Array<{ id: string; name: string; state: string }>> {
  let last = await listAirlockContainers();
  for (let attempt = 1; attempt < attempts && last.length > 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    last = await listAirlockContainers();
  }
  return last;
}

export async function waitForContainerRunning(
  containerId: string,
  timeoutMs = 15000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state = await getContainerState(containerId);
    if (state === 'running') {
      return true;
    }
    if (state === 'exited' || state === 'dead') {
      return false;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}
