import {
  detectFirstReachableEngine,
  type ContainerEngineKind,
  type EngineProbeResult,
} from './engineDetect.js';
import {
  getActiveEngineConnection,
  setActiveEngineConnection,
  type DockerEngineConnection,
} from './engineClient.js';
import { probeEngineHardening } from './engineHardening.js';
import { createDockerClient } from './engineClient.js';

export type EngineRuntimeStatus = {
  connected: boolean;
  kind: ContainerEngineKind;
  displayName: string;
  endpoint: string;
  serverVersion?: string;
  hardening: { supported: boolean; reasons: string[] };
};

let cachedStatus: EngineRuntimeStatus | null = null;

function summarize(probe: EngineProbeResult, hardening: { supported: boolean; reasons: string[] }): EngineRuntimeStatus {
  return {
    connected: true,
    kind: probe.kind,
    displayName: probe.displayName,
    endpoint: probe.endpoint,
    serverVersion: probe.serverVersion,
    hardening,
  };
}

function disconnectedStatus(): EngineRuntimeStatus {
  return {
    connected: false,
    kind: 'unknown',
    displayName: 'None',
    endpoint: '',
    hardening: { supported: false, reasons: ['No container engine API was reachable.'] },
  };
}

export function getCachedEngineRuntimeStatus(): EngineRuntimeStatus | null {
  return cachedStatus;
}

/**
 * Auto-detect Docker-compatible engines (Docker, Podman, OrbStack, Colima, Rancher Desktop)
 * and configure the shared dockerode client for the first reachable socket.
 */
export async function refreshEngineRuntime(options?: {
  force?: boolean;
}): Promise<EngineRuntimeStatus> {
  if (!options?.force && cachedStatus) {
    return cachedStatus;
  }

  const probe = await detectFirstReachableEngine();
  if (!probe) {
    setActiveEngineConnection(null);
    cachedStatus = disconnectedStatus();
    return cachedStatus;
  }

  setActiveEngineConnection(probe.connection);
  const docker = createDockerClient(probe.connection);
  const hardening = await probeEngineHardening(docker);
  cachedStatus = summarize(probe, hardening);
  return cachedStatus;
}

export function clearEngineRuntimeCache(): void {
  cachedStatus = null;
}

export function engineRuntimeAllowsSessions(status: EngineRuntimeStatus): boolean {
  return status.connected && status.hardening.supported;
}

export function connectionSummary(connection: DockerEngineConnection | null): string {
  const active = connection ?? getActiveEngineConnection();
  if (!active) {
    return 'none';
  }
  if (active.host) {
    return active.host;
  }
  if (active.socketPath) {
    return `unix://${active.socketPath}`;
  }
  return active.label;
}
