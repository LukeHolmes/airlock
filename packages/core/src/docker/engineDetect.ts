import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createDockerClient, type DockerEngineConnection } from './engineClient.js';

export type EngineInfoSnapshot = {
  ServerVersion?: string;
  Name?: string;
  OperatingSystem?: string;
};

export type ContainerEngineKind =
  | 'docker'
  | 'podman'
  | 'orbstack'
  | 'colima'
  | 'rancher-desktop'
  | 'unknown';

export type EngineProbeResult = {
  connected: boolean;
  kind: ContainerEngineKind;
  displayName: string;
  connection: DockerEngineConnection;
  serverVersion?: string;
  endpoint: string;
};

const HOME = os.homedir();

function existsSocket(socketPath: string): boolean {
  try {
    return fs.existsSync(socketPath);
  } catch {
    return false;
  }
}

function socketCandidate(
  kind: ContainerEngineKind,
  label: string,
  socketPath: string,
): DockerEngineConnection | null {
  if (!existsSocket(socketPath)) {
    return null;
  }
  return { label, socketPath };
}

/** Ordered probe targets — first successful ping wins. */
export function listEngineConnectionCandidates(): DockerEngineConnection[] {
  const seen = new Set<string>();
  const out: DockerEngineConnection[] = [];

  const push = (conn: DockerEngineConnection | null) => {
    if (!conn) {
      return;
    }
    const key = conn.host ?? conn.socketPath ?? conn.label;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push(conn);
  };

  if (process.env.DOCKER_HOST) {
    push({ label: 'DOCKER_HOST', host: process.env.DOCKER_HOST });
  }

  push(socketCandidate('docker', 'Docker (system)', '/var/run/docker.sock'));
  push(socketCandidate('podman', 'Podman', '/run/podman/podman.sock'));
  push(socketCandidate('podman', 'Podman', '/var/run/podman/podman.sock'));
  push(socketCandidate('podman', 'Podman (user)', path.join(HOME, '.local/share/containers/podman/machine/podman.sock')));
  push(socketCandidate('colima', 'Colima', path.join(HOME, '.colima/default/docker.sock')));
  push(socketCandidate('colima', 'Colima', path.join(HOME, '.colima/docker.sock')));
  push(socketCandidate('orbstack', 'OrbStack', path.join(HOME, '.orbstack/run/docker.sock')));
  push(socketCandidate('rancher-desktop', 'Rancher Desktop', path.join(HOME, '.rd/docker.sock')));
  push(
    socketCandidate(
      'rancher-desktop',
      'Rancher Desktop',
      path.join(HOME, '.rancher-desktop/v1/docker.sock'),
    ),
  );
  push(socketCandidate('docker', 'Docker Desktop', path.join(HOME, '.docker/run/docker.sock')));
  push(socketCandidate('docker', 'Docker Desktop (legacy)', path.join(HOME, '.docker/desktop/docker.sock')));

  return out;
}

export function classifyEngineKind(info: EngineInfoSnapshot): ContainerEngineKind {
  const version = (info.ServerVersion ?? '').toLowerCase();
  const name = (info.Name ?? '').toLowerCase();
  const os = (info.OperatingSystem ?? '').toLowerCase();

  if (version.includes('podman')) {
    return 'podman';
  }
  if (name.includes('orbstack') || os.includes('orbstack')) {
    return 'orbstack';
  }
  if (name.includes('colima') || os.includes('colima')) {
    return 'colima';
  }
  if (name.includes('rancher') || os.includes('rancher desktop')) {
    return 'rancher-desktop';
  }
  if (version || name.includes('docker') || os.includes('docker')) {
    return 'docker';
  }
  return 'unknown';
}

export function displayNameForKind(
  kind: ContainerEngineKind,
  connection: DockerEngineConnection,
): string {
  if (kind !== 'unknown') {
    const labels: Record<ContainerEngineKind, string> = {
      docker: 'Docker',
      podman: 'Podman',
      orbstack: 'OrbStack',
      colima: 'Colima',
      'rancher-desktop': 'Rancher Desktop',
      unknown: connection.label,
    };
    return labels[kind];
  }
  return connection.label;
}

function endpointForConnection(connection: DockerEngineConnection): string {
  if (connection.host) {
    return connection.host;
  }
  if (connection.socketPath) {
    return `unix://${connection.socketPath}`;
  }
  return 'default';
}

export async function probeEngineConnection(
  connection: DockerEngineConnection,
): Promise<EngineProbeResult | null> {
  const docker = createDockerClient(connection);
  try {
    await docker.ping();
    const info = (await docker.info()) as EngineInfoSnapshot & {
      SecurityOptions?: string[];
    };
    const kind = classifyEngineKind(info);
    return {
      connected: true,
      kind,
      displayName: displayNameForKind(kind, connection),
      connection,
      serverVersion: info.ServerVersion,
      endpoint: endpointForConnection(connection),
    };
  } catch {
    return null;
  }
}

export async function detectFirstReachableEngine(): Promise<EngineProbeResult | null> {
  for (const candidate of listEngineConnectionCandidates()) {
    const result = await probeEngineConnection(candidate);
    if (result) {
      return result;
    }
  }
  return null;
}
