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

export async function waitForVnc(port: number, timeoutMs = 15000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  const url = `http://127.0.0.1:${port}`;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch {
      // KasmVNC not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

export async function listAirlockContainers(): Promise<
  Array<{ id: string; name: string; state: string }>
> {
  const docker = getDocker();
  const containers = await docker.listContainers({
    all: true,
    filters: {
      label: ['airlock_session=true'],
    },
  });

  return containers.map((container) => ({
    id: container.Id,
    name: container.Names[0]?.replace(/^\//, '') ?? container.Id.slice(0, 12),
    state: container.State,
  }));
}

export async function cleanupStaleAirlockContainers(): Promise<number> {
  const docker = getDocker();
  const stale = await listAirlockContainers();
  let removed = 0;

  for (const entry of stale) {
    const container = docker.getContainer(entry.id);
    try {
      try {
        await container.stop({ t: 5 });
      } catch {
        // already stopped
      }
      await container.remove({ force: true, v: true });
      removed += 1;
    } catch {
      // ignore individual cleanup failures
    }
  }

  return removed;
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
