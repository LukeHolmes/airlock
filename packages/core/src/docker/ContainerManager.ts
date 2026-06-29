/**
 * ContainerManager — dockerode lifecycle manager for Airlock
 *
 * Derived from Dangerzone's isolation_provider/container.py security model:
 * - Internal bridge network when VNC is published (no external egress)
 * - NetworkMode: 'none' when no VNC port is needed
 * - CapDrop: ['ALL'] (drop all capabilities)
 * - SecurityOpt: ['no-new-privileges', 'seccomp=<profile>']
 * - Read-only bind mounts for input files
 * - Non-root container user
 *
 * Violent garbage collection: if the main process crashes, all containers
 * in the session registry are synchronously force-killed.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import Dockerode from 'dockerode';
import { ensureIsolatedNetwork } from './network.js';
import { detectRuntimeBinary, detectRuntimeSocket } from './runtime.js';
import { serializeSeccompProfile } from './seccomp.js';

// Lazily loaded dockerode to avoid side effects at module load time
let dockerClient: Dockerode | undefined;

const VNC_CONTAINER_PORT = '6901/tcp';

function getDocker(): Dockerode {
  if (!dockerClient) {
    const { socketPath } = detectRuntimeSocket();
    dockerClient = new Dockerode({ socketPath });
  }
  return dockerClient;
}

async function ensureImageExists(docker: Dockerode, image: string): Promise<void> {
  try {
    await docker.getImage(image).inspect();
  } catch {
    throw new Error(`Sandbox image "${image}" not found. Build it with: pnpm sandbox:build`);
  }
}

/**
 * Container configuration with security hardening.
 */
export interface AirlockContainerConfig {
  /** Container image to run (e.g., "airlock/sandbox:latest") */
  image: string;
  /** Human-readable name for this container instance */
  name: string;
  /** Command override — omit to use image default (supervisord entrypoint) */
  cmd?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Read-only file mounts: hostPath -> containerPath */
  mounts?: Array<{
    hostPath: string;
    containerPath: string;
    readOnly: boolean;
  }>;
  /** Writable tmpfs directories for /tmp, /var/tmp, etc. */
  tmpfs?: Record<string, string>;
  /** Working directory inside container */
  workingDir?: string;
  /** User to run as (default: non-root) */
  user?: string;
  /** Enable debug mode for gVisor/runsc */
  debug?: boolean;
  /** Publish KasmVNC port to a random host port on 127.0.0.1 */
  publishVnc?: boolean;
  /** Network access mode — isolated (default) or enabled (bridge with egress) */
  networkMode?: 'isolated' | 'enabled';
}

/**
 * Active container session record.
 */
export interface ContainerSession {
  id: string;
  name: string;
  createdAt: Date;
  config: AirlockContainerConfig;
  /** Base VNC URL on the host, e.g. http://127.0.0.1:32784 */
  vncUrl?: string;
  /** Full KasmVNC client page URL */
  vncPageUrl?: string;
}

/**
 * Registry of all active container sessions.
 * Used for violent garbage collection on crash.
 */
class ContainerRegistry {
  private sessions: Map<string, ContainerSession> = new Map();

  register(session: ContainerSession): void {
    this.sessions.set(session.id, session);
  }

  unregister(id: string): void {
    this.sessions.delete(id);
  }

  getAll(): ContainerSession[] {
    return Array.from(this.sessions.values());
  }

  get(id: string): ContainerSession | undefined {
    return this.sessions.get(id);
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }

  size(): number {
    return this.sessions.size;
  }
}

// Global registry for tracking active containers
const registry = new ContainerRegistry();

// Track if crash trap is already installed to avoid duplicate handlers
let crashTrapInstalled = false;

/**
 * Install the violent garbage collection crash trap.
 *
 * If the Electron main process crashes, exits, or is force-quit,
 * this trap fires and issues synchronous docker kill + rm against
 * all containers in the registry.
 *
 * Must be called once at application startup.
 */
export function installCrashTrap(): void {
  if (crashTrapInstalled) {
    return;
  }
  crashTrapInstalled = true;

  process.on('uncaughtException', (err: Error) => {
    console.error('[airlock] Uncaught exception — initiating violent GC');
    console.error(err);
    violentGarbageCollect();
    throw err;
  });

  process.on('unhandledRejection', (reason: unknown) => {
    console.error('[airlock] Unhandled rejection — initiating violent GC');
    console.error(reason);
    violentGarbageCollect();
    throw reason;
  });

  process.on('beforeExit', () => {
    console.error('[airlock] beforeExit — initiating violent GC');
    violentGarbageCollect();
  });

  process.on('SIGTERM', () => {
    console.error('[airlock] SIGTERM received — initiating violent GC');
    violentGarbageCollect();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.error('[airlock] SIGINT received — initiating violent GC');
    violentGarbageCollect();
    process.exit(0);
  });
}

/**
 * Violent garbage collection: synchronously kill and remove all
 * containers in the session registry.
 */
export function violentGarbageCollect(): void {
  const sessions = registry.getAll();
  if (sessions.length === 0) {
    return;
  }

  let bin = 'docker';
  try {
    bin = detectRuntimeBinary();
  } catch {
    // crash path — binary detection failed, fall back to 'docker'
    // do not rethrow: we are already handling a process exit
  }

  console.error(`[airlock] Violent GC: destroying ${sessions.length} container(s)`);

  for (const session of sessions) {
    try {
      try {
        execSync(`${bin} kill ${session.id} 2>/dev/null`, { timeout: 5000 });
      } catch {
        // Ignore errors — container may already be dead
      }

      try {
        execSync(`${bin} rm -f ${session.id} 2>/dev/null`, { timeout: 5000 });
      } catch {
        // Ignore errors — container may already be removed
      }

      registry.unregister(session.id);
      console.error(`[airlock] Destroyed container ${session.name} (${session.id.slice(0, 12)})`);
    } catch (e) {
      console.error(`[airlock] Failed to destroy container ${session.name}:`, e);
    }
  }
}

function getSeccompSecurityOpt(): string {
  // Inline JSON profile — Docker API parses seccomp= values starting with '{' as JSON.
  // File paths are unreliable through dockerode's API encoding on some hosts.
  return `seccomp=${serializeSeccompProfile()}`;
}

async function resolveContainerNetworkMode(
  docker: Dockerode,
  config: AirlockContainerConfig,
): Promise<string> {
  if (config.networkMode === 'enabled') {
    return 'bridge';
  }

  // Isolated: use the air-gapped bridge when VNC port publishing is required.
  if (config.publishVnc) {
    return ensureIsolatedNetwork(docker);
  }

  return 'none';
}

function resolveVncUrls(info: Dockerode.ContainerInspectInfo): {
  vncUrl?: string;
  vncPageUrl?: string;
} {
  const bindings = info.NetworkSettings.Ports?.[VNC_CONTAINER_PORT];
  const hostPort = bindings?.[0]?.HostPort;
  if (!hostPort) {
    return {};
  }

  const vncUrl = `http://127.0.0.1:${hostPort}`;
  const vncPageUrl = `${vncUrl}/vnc.html?autoconnect=true&resize=scale`;
  return { vncUrl, vncPageUrl };
}

async function waitForVncReady(
  container: Dockerode.Container,
  timeoutMs = 15000,
): Promise<{ vncUrl?: string; vncPageUrl?: string }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const info = await container.inspect();
    const urls = resolveVncUrls(info);

    if (urls.vncUrl) {
      try {
        const response = await fetch(urls.vncUrl);
        if (response.ok) {
          return urls;
        }
      } catch {
        // KasmVNC not accepting connections yet
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const info = await container.inspect();
  return resolveVncUrls(info);
}

/**
 * Build the Docker HostConfig with full security hardening.
 */
function buildHostConfig(
  config: AirlockContainerConfig,
  networkMode: string,
): Dockerode.ContainerCreateOptions['HostConfig'] {
  const binds: string[] = (config.mounts ?? []).map((m) => {
    const roFlag = m.readOnly ? ':ro' : '';
    return `${m.hostPath}:${m.containerPath}${roFlag}`;
  });

  const tmpfs: Record<string, string> = config.tmpfs ?? {
    '/tmp': 'rw,noexec,nosuid,size=100m',
    '/var/tmp': 'rw,noexec,nosuid,size=50m',
  };

  const securityOpt: string[] = ['no-new-privileges', getSeccompSecurityOpt()];

  const hostConfig: Dockerode.ContainerCreateOptions['HostConfig'] = {
    NetworkMode: networkMode,
    CapDrop: ['ALL'],
    SecurityOpt: securityOpt,
    Binds: binds,
    Tmpfs: tmpfs,
    AutoRemove: true,
  };

  if (config.publishVnc) {
    hostConfig.PortBindings = {
      [VNC_CONTAINER_PORT]: [{ HostIp: '127.0.0.1', HostPort: '0' }],
    };
  }

  return hostConfig;
}

/**
 * Create and start a hardened Airlock container.
 *
 * Uses the image default CMD (supervisord) unless cmd is explicitly provided.
 * Registers the session for violent GC on main-process crash.
 */
export async function createContainer(config: AirlockContainerConfig): Promise<ContainerSession> {
  const docker = getDocker();

  await ensureImageExists(docker, config.image);

  const envArray = Object.entries(config.env ?? {}).map(([key, value]) => `${key}=${value}`);

  if (config.debug) {
    envArray.push('RUNSC_DEBUG=1');
  }

  const networkMode = await resolveContainerNetworkMode(docker, config);
  const hostConfig = buildHostConfig(config, networkMode);

  const createOptions: Dockerode.ContainerCreateOptions = {
    Image: config.image,
    name: config.name,
    Env: envArray,
    WorkingDir: config.workingDir ?? '/home/airlock',
    User: config.user ?? '1000:1000',
    HostConfig: hostConfig,
    AttachStdin: false,
    AttachStdout: true,
    AttachStderr: true,
    OpenStdin: false,
    StdinOnce: false,
    Labels: {
      'app.airlock.managed': 'true',
      'app.airlock.session': config.name,
      'app.airlock.created': new Date().toISOString(),
    },
  };

  if (config.cmd && config.cmd.length > 0) {
    createOptions.Cmd = config.cmd;
  }

  if (config.publishVnc) {
    createOptions.ExposedPorts = { [VNC_CONTAINER_PORT]: {} };
  }

  const container = await docker.createContainer(createOptions);
  await container.start();

  const { vncUrl, vncPageUrl } = config.publishVnc
    ? await waitForVncReady(container)
    : resolveVncUrls(await container.inspect());

  const info = await container.inspect();

  const session: ContainerSession = {
    id: info.Id,
    name: config.name,
    createdAt: new Date(),
    config,
    vncUrl,
    vncPageUrl,
  };
  registry.register(session);

  console.log(
    `[airlock] Created container ${config.name} (${session.id.slice(0, 12)})` +
      (vncUrl ? ` vnc=${vncUrl}` : ''),
  );

  return session;
}

export async function destroyContainer(sessionId: string): Promise<void> {
  if (!registry.has(sessionId)) {
    console.warn(`[airlock] Container ${sessionId} not in registry — may be already destroyed`);
  }

  const docker = getDocker();
  const container = docker.getContainer(sessionId);

  try {
    await container.stop({ t: 10 });
  } catch {
    console.log(`[airlock] Stop failed for ${sessionId}, attempting kill`);
    try {
      await container.kill();
    } catch {
      // Ignore — container may already be dead
    }
  }

  try {
    await container.remove({ force: true, v: true });
  } catch (e: unknown) {
    console.warn(`[airlock] Container removal failed for ${sessionId}:`, e);
  }

  registry.unregister(sessionId);

  console.log(`[airlock] Destroyed container ${sessionId.slice(0, 12)}`);
}

export async function killContainer(sessionId: string): Promise<void> {
  const docker = getDocker();
  const container = docker.getContainer(sessionId);

  try {
    await container.kill();
  } catch {
    // Ignore — container may already be dead
  }

  try {
    await container.remove({ force: true, v: true });
  } catch {
    // Ignore — container may already be removed
  }

  registry.unregister(sessionId);

  console.log(`[airlock] Force-killed container ${sessionId.slice(0, 12)}`);
}

export function getActiveSessions(): ContainerSession[] {
  return registry.getAll();
}

export async function isContainerRunning(sessionId: string): Promise<boolean> {
  const docker = getDocker();
  const container = docker.getContainer(sessionId);

  try {
    const info = await container.inspect();
    return info.State.Running;
  } catch {
    return false;
  }
}

const INPUT_MOUNT_DIR = '/home/airlock/workspace/input';

/**
 * Create a container for opening a file in the sandbox.
 *
 * Mounts the file read-only and passes TARGET_FILE to launch-target.sh
 * via the supervisord startup path (image default CMD).
 */
export async function createFileContainer(
  filePath: string,
  options?: {
    name?: string;
    image?: string;
    debug?: boolean;
    networkMode?: 'isolated' | 'enabled';
  },
): Promise<ContainerSession> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase() || '';
  const containerTargetPath = `${INPUT_MOUNT_DIR}/target${ext}`;

  const timestamp = Date.now();
  const basename = path.basename(filePath, ext);
  const safeName = basename.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 20);
  const containerName = options?.name ?? `airlock-${safeName}-${timestamp}`;

  return createContainer({
    image: options?.image ?? 'airlock/sandbox:latest',
    name: containerName,
    mounts: [
      {
        hostPath: filePath,
        containerPath: containerTargetPath,
        readOnly: true,
      },
    ],
    env: {
      TARGET_FILE: containerTargetPath,
      TARGET_URL: '',
      DISPLAY: ':1',
      VNC_RESOLUTION: '1920x1080',
    },
    publishVnc: true,
    debug: options?.debug ?? false,
    networkMode: options?.networkMode ?? 'isolated',
  });
}

/**
 * Create a container for opening a URL in the sandbox.
 *
 * Passes TARGET_URL to launch-target.sh. Requires networkMode 'enabled'.
 */
export async function createUrlContainer(
  url: string,
  options?: {
    name?: string;
    image?: string;
    debug?: boolean;
    networkMode?: 'isolated' | 'enabled';
  },
): Promise<ContainerSession> {
  const validProtocols = ['http:', 'https:'];
  const urlObj = new URL(url);
  if (!validProtocols.includes(urlObj.protocol)) {
    throw new Error(`Invalid URL protocol: ${urlObj.protocol}`);
  }

  const timestamp = Date.now();
  const host = urlObj.hostname.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 20);
  const containerName = options?.name ?? `airlock-url-${host}-${timestamp}`;

  return createContainer({
    image: options?.image ?? 'airlock/sandbox:latest',
    name: containerName,
    env: {
      TARGET_FILE: '',
      TARGET_URL: url,
      DISPLAY: ':1',
      VNC_RESOLUTION: '1920x1080',
    },
    publishVnc: true,
    debug: options?.debug ?? false,
    networkMode: options?.networkMode ?? 'enabled',
  });
}
