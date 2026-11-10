/**
 * Deterministic cleanup for Airlock-managed Docker containers.
 *
 * Only touches containers carrying `app.airlock.managed=true`. Containers
 * owned by a live foreign PID are skipped so another app/session is never disturbed.
 */

import Dockerode from 'dockerode';

export const MANAGED_LABEL = 'app.airlock.managed';
export const SESSION_LABEL = 'airlock_session';
export const OWNER_PID_LABEL = 'app.airlock.owner_pid';

export const MAX_MANAGED_CLEANUP = 32;

export interface ManagedContainerSummary {
  id: string;
  name: string;
  state: string;
  ownerPid?: number;
}

export function parseOwnerPid(labels: Record<string, string>): number | undefined {
  const raw = labels[OWNER_PID_LABEL];
  if (!raw) {
    return undefined;
  }
  const pid = Number(raw);
  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
}

/**
 * Returns true when the PID still exists on this host (or is visible but not signalable).
 */
export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    return err.code === 'EPERM';
  }
}

export function isManagedAirlockLabels(labels: Record<string, string>): boolean {
  return labels[MANAGED_LABEL] === 'true' || labels[SESSION_LABEL] === 'true';
}

/**
 * A managed container may be reclaimed when it belongs to this process or its owner PID is gone.
 */
export function isReclaimableManagedContainer(
  labels: Record<string, string>,
  currentPid: number,
): boolean {
  if (!isManagedAirlockLabels(labels)) {
    return false;
  }

  const ownerPid = parseOwnerPid(labels);
  if (ownerPid === undefined) {
    return true;
  }
  if (ownerPid === currentPid) {
    return true;
  }
  return !isProcessAlive(ownerPid);
}

function trimDockerName(name: string | undefined, id: string): string {
  if (!name) {
    return id.slice(0, 12);
  }
  return name.replace(/^\//, '');
}

export async function listManagedAirlockContainers(
  docker: Dockerode,
): Promise<ManagedContainerSummary[]> {
  const containers = await docker.listContainers({
    all: true,
    filters: {
      label: [`${MANAGED_LABEL}=true`],
    },
  });

  return containers.slice(0, MAX_MANAGED_CLEANUP).map((entry) => ({
    id: entry.Id,
    name: trimDockerName(entry.Names[0], entry.Id),
    state: entry.State,
    ownerPid: parseOwnerPid(entry.Labels ?? {}),
  }));
}

export async function waitForContainerAbsent(
  docker: Dockerode,
  containerId: string,
  timeoutMs = 5000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await docker.getContainer(containerId).inspect();
    } catch {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

/**
 * Idempotent stop/remove for a single managed container id.
 */
export async function forceDestroyContainerId(
  docker: Dockerode,
  containerId: string,
): Promise<boolean> {
  const container = docker.getContainer(containerId);

  try {
    try {
      await container.stop({ t: 5 });
    } catch {
      try {
        await container.kill();
      } catch {
        // already stopped or missing
      }
    }

    try {
      await container.remove({ force: true, v: true });
    } catch {
      // 404 / already removed
    }

    return await waitForContainerAbsent(docker, containerId, 5000);
  } catch {
    return false;
  }
}

export interface ManagedCleanupResult {
  destroyed: string[];
  skipped: string[];
}

/**
 * Destroy all managed containers owned by `ownerPid` (default: current process).
 */
export async function destroyManagedContainersForOwner(
  docker: Dockerode,
  ownerPid: number = process.pid,
  options?: { extraIds?: string[] },
): Promise<ManagedCleanupResult> {
  const destroyed: string[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  const managed = await listManagedAirlockContainers(docker);
  const candidates = [...managed];

  for (const extraId of options?.extraIds ?? []) {
    if (!seen.has(extraId)) {
      candidates.push({ id: extraId, name: extraId.slice(0, 12), state: 'unknown' });
    }
  }

  for (const entry of candidates) {
    if (seen.has(entry.id)) {
      continue;
    }
    seen.add(entry.id);

    if (destroyed.length + skipped.length >= MAX_MANAGED_CLEANUP) {
      skipped.push(entry.id);
      continue;
    }

    let labels: Record<string, string> = { [MANAGED_LABEL]: 'true' };
    try {
      const info = await docker.getContainer(entry.id).inspect();
      labels = info.Config?.Labels ?? labels;
    } catch {
      if (await forceDestroyContainerId(docker, entry.id)) {
        destroyed.push(entry.id);
      }
      continue;
    }

    const owner = parseOwnerPid(labels);
    if (owner !== undefined && owner !== ownerPid) {
      skipped.push(entry.id);
      continue;
    }

    if (await forceDestroyContainerId(docker, entry.id)) {
      destroyed.push(entry.id);
    } else {
      skipped.push(entry.id);
    }
  }

  return { destroyed, skipped };
}

/**
 * Remove stale managed containers left by crashed or interrupted processes.
 */
export async function reclaimStaleManagedContainers(
  docker: Dockerode,
  currentPid: number = process.pid,
): Promise<ManagedCleanupResult> {
  const destroyed: string[] = [];
  const skipped: string[] = [];

  const managed = await listManagedAirlockContainers(docker);
  for (const entry of managed) {
    if (destroyed.length + skipped.length >= MAX_MANAGED_CLEANUP) {
      break;
    }

    let labels: Record<string, string> = {};
    try {
      const info = await docker.getContainer(entry.id).inspect();
      labels = info.Config?.Labels ?? {};
    } catch {
      continue;
    }

    if (!isReclaimableManagedContainer(labels, currentPid)) {
      skipped.push(entry.id);
      continue;
    }

    if (await forceDestroyContainerId(docker, entry.id)) {
      destroyed.push(entry.id);
    } else {
      skipped.push(entry.id);
    }
  }

  return { destroyed, skipped };
}
