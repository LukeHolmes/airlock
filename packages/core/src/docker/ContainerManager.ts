/**
 * ContainerManager — dockerode lifecycle manager for Airlock
 *
 * Derived from Dangerzone's isolation_provider/container.py security model:
 * - NetworkMode: 'none' (air-gapped)
 * - CapDrop: ['ALL'] (drop all capabilities)
 * - SecurityOpt: ['no-new-privileges', 'seccomp=<profile>']
 * - Read-only bind mounts for input files
 * - Non-root container user
 *
 * Violent garbage collection: if the main process crashes, all containers
 * in the session registry are synchronously force-killed.
 */

import Dockerode from 'dockerode';
import { serializeSeccompProfile } from './seccomp.js';

// Lazily loaded dockerode to avoid side effects at module load time
let dockerClient: Dockerode | undefined;

function getDocker(): Dockerode {
  if (!dockerClient) {
    dockerClient = new Dockerode();
  }
  return dockerClient;
}

/**
 * Container configuration with security hardening.
 */
export interface AirlockContainerConfig {
  /** Container image to run (e.g., "airlock/sandbox:latest") */
  image: string;
  /** Human-readable name for this container instance */
  name: string;
  /** Command to run inside the container */
  cmd: string[];
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
}

/**
 * Active container session record.
 */
interface ContainerSession {
  id: string;
  name: string;
  createdAt: Date;
  config: AirlockContainerConfig;
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

  // Uncaught exception handler — attempt graceful-ish cleanup
  process.on('uncaughtException', (err: Error) => {
    console.error('[airlock] Uncaught exception — initiating violent GC');
    console.error(err);
    violentGarbageCollect();
    // Re-throw to ensure process exits with error
    throw err;
  });

  // Unhandled promise rejection — same treatment
  process.on('unhandledRejection', (reason: unknown) => {
    console.error('[airlock] Unhandled rejection — initiating violent GC');
    console.error(reason);
    violentGarbageCollect();
    throw reason;
  });

  // Before exit — final cleanup opportunity
  process.on('beforeExit', () => {
    console.error('[airlock] beforeExit — initiating violent GC');
    violentGarbageCollect();
  });

  // SIGTERM — container orchestrators send this
  process.on('SIGTERM', () => {
    console.error('[airlock] SIGTERM received — initiating violent GC');
    violentGarbageCollect();
    process.exit(0);
  });

  // SIGINT — Ctrl+C
  process.on('SIGINT', () => {
    console.error('[airlock] SIGINT received — initiating violent GC');
    violentGarbageCollect();
    process.exit(0);
  });
}

/**
 * Violent garbage collection: synchronously kill and remove all
 * containers in the session registry.
 *
 * Called automatically by crash traps, or can be invoked manually
 * for session teardown.
 */
export function violentGarbageCollect(): void {
  const sessions = registry.getAll();
  if (sessions.length === 0) {
    return;
  }

  console.error(`[airlock] Violent GC: destroying ${sessions.length} container(s)`);

  for (const session of sessions) {
    try {
      // Synchronous destruction: we use execSync because async
      // cleanup won't complete before process exit
      const { execSync } = require('child_process') as typeof import('child_process');

      // Try graceful kill first
      try {
        execSync(`docker kill ${session.id} 2>/dev/null`, { timeout: 5000 });
      } catch {
        // Ignore errors — container may already be dead
      }

      // Force remove the container
      try {
        execSync(`docker rm -f ${session.id} 2>/dev/null`, { timeout: 5000 });
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

/**
 * Generate the serialized seccomp profile JSON for HostConfig.
 * The profile is written to a temporary location and referenced
 * via security-opt.
 *
 * Note: In production, this should be written to a known path
 * and reused rather than regenerated on each container creation.
 */
function getSeccompSecurityOpt(): string {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const os = require('os') as typeof import('os');

  const profileJson = serializeSeccompProfile();
  const tmpDir = os.tmpdir();
  const profilePath = path.join(tmpDir, 'airlock-seccomp.json');

  // Write profile to temp location (idempotent if unchanged)
  fs.writeFileSync(profilePath, profileJson, { encoding: 'utf-8' });

  return `seccomp=${profilePath}`;
}

/**
 * Build the Docker HostConfig with full security hardening.
 *
 * Security profile derived from Dangerzone:
 * - NetworkMode: 'none' (air-gapped)
 * - CapDrop: ['ALL'] (no capabilities)
 * - SecurityOpt: ['no-new-privileges', 'seccomp=<profile>']
 * - Read-only root filesystem disabled (app needs /tmp writes)
 * - Non-root user execution
 */
function buildHostConfig(
  config: AirlockContainerConfig,
): Dockerode.ContainerCreateOptions['HostConfig'] {
  // Build binds from mounts — input files are read-only (:ro)
  const binds: string[] = (config.mounts ?? []).map((m) => {
    const roFlag = m.readOnly ? ':ro' : '';
    return `${m.hostPath}:${m.containerPath}${roFlag}`;
  });

  // Build tmpfs mounts for writable areas
  const tmpfs: Record<string, string> = config.tmpfs ?? {
    '/tmp': 'rw,noexec,nosuid,size=100m',
    '/var/tmp': 'rw,noexec,nosuid,size=50m',
  };

  // Security options from Dangerzone profile
  const securityOpt: string[] = [
    'no-new-privileges', // Do not let the container assume new privileges
    getSeccompSecurityOpt(), // Custom seccomp policy
  ];

  return {
    // Air-gapped: no network access
    NetworkMode: 'none',

    // Drop all capabilities (we don't need SYS_CHROOT like Dangerzone/gVisor)
    CapDrop: ['ALL'],

    // Security options: no-new-privileges + custom seccomp
    SecurityOpt: securityOpt,

    // File system: read-only mounts for inputs, tmpfs for writable areas
    Binds: binds,
    Tmpfs: tmpfs,

    // Auto-remove container on stop (best effort)
    AutoRemove: true,

    // Resource limits
    Memory: 512 * 1024 * 1024, // 512MB default limit
    MemorySwap: 512 * 1024 * 1024, // No swap
    CpuQuota: 100000, // 1 CPU default
    CpuPeriod: 100000,
  };
}

/**
 * Create and start a hardened Airlock container.
 *
 * The container is created with the full Dangerzone-derived security profile:
 * - NetworkMode: 'none' (air-gapped by default)
 * - CapDrop: ['ALL'] (all capabilities dropped)
 * - SecurityOpt: ['no-new-privileges', 'seccomp=<profile>']
 * - Read-only input file mounts
 * - Non-root user execution
 *
 * The container ID is registered in the session registry for
 * violent garbage collection if the main process crashes.
 *
 * @returns Container session with ID for tracking
 */
export async function createContainer(config: AirlockContainerConfig): Promise<ContainerSession> {
  const docker = getDocker();

  // Prepare environment as array of KEY=VALUE strings
  const envArray = Object.entries(config.env ?? {}).map(([key, value]) => `${key}=${value}`);

  // Add debug flag if requested
  if (config.debug) {
    envArray.push('RUNSC_DEBUG=1');
  }

  // Build the hardened HostConfig
  const hostConfig = buildHostConfig(config);

  // Container creation options
  const createOptions: Dockerode.ContainerCreateOptions = {
    Image: config.image,
    name: config.name,
    Cmd: config.cmd,
    Env: envArray,
    WorkingDir: config.workingDir ?? '/workspace',
    User: config.user ?? '1000:1000', // Non-root user (nobody)
    HostConfig: hostConfig,
    // Prevent stdin/stdout unless explicitly needed
    AttachStdin: false,
    AttachStdout: true,
    AttachStderr: true,
    OpenStdin: false,
    StdinOnce: false,
    // Labels for identification
    Labels: {
      'app.airlock.managed': 'true',
      'app.airlock.session': config.name,
      'app.airlock.created': new Date().toISOString(),
    },
  };

  // Create the container
  const container = await docker.createContainer(createOptions);

  // Start the container
  await container.start();

  // Inspect to get full details
  const info = await container.inspect();

  // Register for crash tracking
  const session: ContainerSession = {
    id: info.Id,
    name: config.name,
    createdAt: new Date(),
    config,
  };
  registry.register(session);

  console.log(`[airlock] Created container ${config.name} (${session.id.slice(0, 12)})`);

  return session;
}

/**
 * Gracefully stop and remove a container.
 *
 * Uses the standard Docker stop/kill flow:
 * 1. Stop with timeout (graceful shutdown)
 * 2. Kill if still running
 * 3. Remove the container
 *
 * Also unregisters from the session registry.
 */
export async function destroyContainer(sessionId: string): Promise<void> {
  if (!registry.has(sessionId)) {
    console.warn(`[airlock] Container ${sessionId} not in registry — may be already destroyed`);
  }

  const docker = getDocker();
  const container = docker.getContainer(sessionId);

  try {
    // Attempt graceful stop first (10 second timeout)
    await container.stop({ t: 10 });
  } catch (e: unknown) {
    // Container may already be stopped — try kill
    console.log(`[airlock] Stop failed for ${sessionId}, attempting kill`);
    try {
      await container.kill();
    } catch (killErr) {
      // Ignore — container may already be dead
    }
  }

  // Remove the container (force if necessary)
  try {
    await container.remove({ force: true, v: true });
  } catch (e: unknown) {
    console.warn(`[airlock] Container removal failed for ${sessionId}:`, e);
  }

  // Unregister from crash tracking
  registry.unregister(sessionId);

  console.log(`[airlock] Destroyed container ${sessionId.slice(0, 12)}`);
}

/**
 * Force-kill a container immediately.
 *
 * Used for emergency shutdown or when graceful stop fails.
 */
export async function killContainer(sessionId: string): Promise<void> {
  const docker = getDocker();
  const container = docker.getContainer(sessionId);

  try {
    await container.kill();
  } catch (e: unknown) {
    // Ignore — container may already be dead
  }

  try {
    await container.remove({ force: true, v: true });
  } catch (e: unknown) {
    // Ignore — container may already be removed
  }

  registry.unregister(sessionId);

  console.log(`[airlock] Force-killed container ${sessionId.slice(0, 12)}`);
}

/**
 * Get all active container sessions.
 */
export function getActiveSessions(): ContainerSession[] {
  return registry.getAll();
}

/**
 * Check if a container session is still active.
 */
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

/**
 * Convenience: Create a container for opening a file in the sandbox.
 *
 * Mounts the file as read-only and launches the appropriate viewer
 * (chromium, evince, etc.) based on file type.
 */
export async function createFileContainer(
  filePath: string,
  options?: {
    name?: string;
    image?: string;
    debug?: boolean;
  },
): Promise<ContainerSession> {
  const path = require('path') as typeof import('path');
  const fs = require('fs') as typeof import('fs');

  // Validate file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Determine viewer based on extension
  const ext = path.extname(filePath).toLowerCase();
  let viewerCmd: string[];

  switch (ext) {
    case '.pdf':
      viewerCmd = ['evince', '/workspace/target.pdf'];
      break;
    case '.html':
    case '.htm':
      viewerCmd = ['chromium', '--no-sandbox', '/workspace/target.html'];
      break;
    case '.txt':
    case '.md':
      viewerCmd = ['cat', '/workspace/target.txt'];
      break;
    default:
      // Default to chromium for unknown types
      viewerCmd = ['chromium', '--no-sandbox', '/workspace/target'];
  }

  // Generate unique container name
  const timestamp = Date.now();
  const basename = path.basename(filePath, ext);
  const safeName = basename.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 20);
  const containerName = options?.name ?? `airlock-${safeName}-${timestamp}`;

  return createContainer({
    image: options?.image ?? 'airlock/sandbox:latest',
    name: containerName,
    cmd: viewerCmd,
    mounts: [
      {
        hostPath: filePath,
        containerPath: `/workspace/target${ext}`,
        readOnly: true,
      },
    ],
    env: {
      DISPLAY: ':1', // KasmVNC display
      VNC_RESOLUTION: '1920x1080',
    },
    debug: options?.debug ?? false,
  });
}

/**
 * Convenience: Create a container for opening a URL in the sandbox.
 *
 * Launches chromium with the URL — no file mounts needed.
 */
export async function createUrlContainer(
  url: string,
  options?: {
    name?: string;
    image?: string;
    debug?: boolean;
  },
): Promise<ContainerSession> {
  // Validate URL (basic check)
  const validProtocols = ['http:', 'https:'];
  const urlObj = new URL(url);
  if (!validProtocols.includes(urlObj.protocol)) {
    throw new Error(`Invalid URL protocol: ${urlObj.protocol}`);
  }

  // Generate unique container name
  const timestamp = Date.now();
  const host = urlObj.hostname.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 20);
  const containerName = options?.name ?? `airlock-url-${host}-${timestamp}`;

  return createContainer({
    image: options?.image ?? 'airlock/sandbox:latest',
    name: containerName,
    cmd: ['chromium', '--no-sandbox', url],
    env: {
      DISPLAY: ':1',
      VNC_RESOLUTION: '1920x1080',
    },
    debug: options?.debug ?? false,
  });
}
