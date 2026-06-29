import fs from 'node:fs';
import path from 'node:path';

import Dockerode from 'dockerode';

import { LOCAL_SANDBOX_IMAGE } from './imageCheck.js';
import { detectRuntimeSocket } from './runtime.js';

export { LOCAL_SANDBOX_IMAGE };

export const SANDBOX_BUILD_FILES = [
  'Dockerfile',
  'entrypoint.sh',
  'supervisord.conf',
  'launch-target.sh',
  'start-kasmvnc.sh',
  'cleanup.sh',
] as const;

export type SandboxSetupErrorCode =
  | 'docker_unavailable'
  | 'pull_failed'
  | 'build_failed'
  | 'no_strategy';

export class SandboxSetupError extends Error {
  readonly code: SandboxSetupErrorCode;
  readonly cause?: unknown;

  constructor(code: SandboxSetupErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'SandboxSetupError';
    this.code = code;
    this.cause = cause;
  }
}

export type SandboxImageConfig = {
  appVersion: string;
  ghcrOwner: string;
};

export type SandboxSetupProgress = {
  phase: 'checking' | 'pulling' | 'building' | 'tagging' | 'ready';
  message: string;
  detail?: string;
};

export type EnsureSandboxImageOptions = {
  buildContextPath?: string;
  onProgress?: (progress: SandboxSetupProgress) => void;
};

export type EnsureSandboxImageResult = {
  image: string;
  source: 'local' | 'pulled' | 'bundled';
  pulledRef?: string;
};

type ProgressEvent = {
  status?: string;
  progress?: string;
  id?: string;
};

let sandboxImageConfig: SandboxImageConfig = {
  appVersion: process.env.AIRLOCK_APP_VERSION?.trim() ?? '0.3.1',
  ghcrOwner: (process.env.AIRLOCK_GHCR_OWNER?.trim() ?? 'lukeholmes').toLowerCase(),
};

let dockerClient: Dockerode | undefined;

function getDocker(): Dockerode {
  if (!dockerClient) {
    const { socketPath } = detectRuntimeSocket();
    dockerClient = new Dockerode({ socketPath });
  }
  return dockerClient;
}

export function configureSandboxImage(overrides: Partial<SandboxImageConfig>): void {
  sandboxImageConfig = {
    ...sandboxImageConfig,
    ...overrides,
    ...(overrides.ghcrOwner ? { ghcrOwner: overrides.ghcrOwner.toLowerCase() } : {}),
  };
}

export function getSandboxImageConfig(): SandboxImageConfig {
  return { ...sandboxImageConfig };
}

export function getGhcrSandboxImageRef(version?: string): string {
  const tag = version ?? sandboxImageConfig.appVersion;
  return `ghcr.io/${sandboxImageConfig.ghcrOwner}/airlock-sandbox:${tag}`;
}

/**
 * Ordered remote image refs to pull when the local alias is missing.
 * The local alias `airlock/sandbox:latest` is provisioned by tagging after pull/build.
 */
export function getSandboxImageCandidates(): string[] {
  const candidates: string[] = [];
  const envOverride = process.env.AIRLOCK_SANDBOX_IMAGE?.trim();

  if (envOverride) {
    candidates.push(envOverride);
  }

  candidates.push(getGhcrSandboxImageRef());

  return [...new Set(candidates)];
}

export function isSandboxBuildContext(buildContextPath: string): boolean {
  return SANDBOX_BUILD_FILES.every((file) => fs.existsSync(path.join(buildContextPath, file)));
}

/** @deprecated Use isSandboxBuildContext */
export function isBundledBuildContext(buildContextPath: string): boolean {
  return isSandboxBuildContext(buildContextPath);
}

export function resolveSandboxContextFromCandidates(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (isSandboxBuildContext(candidate)) {
      return candidate;
    }
  }
  return null;
}

function emitProgress(
  onProgress: EnsureSandboxImageOptions['onProgress'],
  progress: SandboxSetupProgress,
): void {
  onProgress?.(progress);
}

async function assertDockerAvailable(docker: Dockerode): Promise<void> {
  try {
    await docker.ping();
  } catch (error) {
    throw new SandboxSetupError(
      'docker_unavailable',
      'Docker is not available. Start Docker Desktop and try again.',
      error,
    );
  }
}

async function followDockerStream(
  docker: Dockerode,
  stream: NodeJS.ReadableStream,
  onLine?: (line: string) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(
      stream,
      (error: Error | null) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      },
      (event: ProgressEvent) => {
        if (!onLine) {
          return;
        }

        const line = [event.status, event.id, event.progress].filter(Boolean).join(' ').trim();
        if (line) {
          onLine(line);
        }
      },
    );
  });
}

async function imageExists(docker: Dockerode, imageRef: string): Promise<boolean> {
  try {
    await docker.getImage(imageRef).inspect();
    return true;
  } catch {
    return false;
  }
}

async function tagImageAsLocal(
  docker: Dockerode,
  sourceRef: string,
  onProgress?: EnsureSandboxImageOptions['onProgress'],
): Promise<void> {
  emitProgress(onProgress, {
    phase: 'tagging',
    message: `Tagging ${sourceRef} as ${LOCAL_SANDBOX_IMAGE}`,
  });

  const image = docker.getImage(sourceRef);
  await image.tag({ repo: 'airlock/sandbox', tag: 'latest' });
}

async function pullImage(
  docker: Dockerode,
  imageRef: string,
  onProgress?: EnsureSandboxImageOptions['onProgress'],
): Promise<void> {
  emitProgress(onProgress, {
    phase: 'pulling',
    message: `Pulling ${imageRef}`,
  });

  const stream = await docker.pull(imageRef);
  await followDockerStream(docker, stream, (detail) => {
    emitProgress(onProgress, {
      phase: 'pulling',
      message: `Pulling ${imageRef}`,
      detail,
    });
  });
}

async function buildImageFromContext(
  docker: Dockerode,
  buildContextPath: string,
  onProgress?: EnsureSandboxImageOptions['onProgress'],
): Promise<void> {
  emitProgress(onProgress, {
    phase: 'building',
    message: `Building ${LOCAL_SANDBOX_IMAGE} from bundled context`,
    detail: buildContextPath,
  });

  const stream = await docker.buildImage(
    {
      context: buildContextPath,
      src: [...SANDBOX_BUILD_FILES],
    },
    { t: LOCAL_SANDBOX_IMAGE },
  );

  await followDockerStream(docker, stream, (detail) => {
    emitProgress(onProgress, {
      phase: 'building',
      message: `Building ${LOCAL_SANDBOX_IMAGE}`,
      detail,
    });
  });
}

/**
 * Ensure `airlock/sandbox:latest` exists locally by reusing, pulling, or building.
 * Does not modify ContainerManager security behaviour.
 */
export async function ensureSandboxImageReady(
  options: EnsureSandboxImageOptions = {},
): Promise<EnsureSandboxImageResult> {
  const docker = getDocker();
  const { onProgress, buildContextPath } = options;

  emitProgress(onProgress, {
    phase: 'checking',
    message: `Checking for ${LOCAL_SANDBOX_IMAGE}`,
  });

  await assertDockerAvailable(docker);

  if (await imageExists(docker, LOCAL_SANDBOX_IMAGE)) {
    emitProgress(onProgress, {
      phase: 'ready',
      message: `${LOCAL_SANDBOX_IMAGE} is already available`,
    });
    return { image: LOCAL_SANDBOX_IMAGE, source: 'local' };
  }

  const pullCandidates = getSandboxImageCandidates();
  const pullErrors: string[] = [];

  for (const candidate of pullCandidates) {
    try {
      await pullImage(docker, candidate, onProgress);

      if (!(await imageExists(docker, candidate))) {
        throw new Error(`Pull completed but image ${candidate} was not found locally`);
      }

      if (candidate !== LOCAL_SANDBOX_IMAGE) {
        await tagImageAsLocal(docker, candidate, onProgress);
      }

      emitProgress(onProgress, {
        phase: 'ready',
        message: `${LOCAL_SANDBOX_IMAGE} is ready`,
        detail: candidate,
      });

      return {
        image: LOCAL_SANDBOX_IMAGE,
        source: 'pulled',
        pulledRef: candidate,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pullErrors.push(`${candidate}: ${message}`);
    }
  }

  if (buildContextPath && isSandboxBuildContext(buildContextPath)) {
    try {
      await buildImageFromContext(docker, buildContextPath, onProgress);

      if (!(await imageExists(docker, LOCAL_SANDBOX_IMAGE))) {
        throw new Error(`Build completed but ${LOCAL_SANDBOX_IMAGE} was not found locally`);
      }

      emitProgress(onProgress, {
        phase: 'ready',
        message: `${LOCAL_SANDBOX_IMAGE} is ready`,
        detail: buildContextPath,
      });

      return { image: LOCAL_SANDBOX_IMAGE, source: 'bundled' };
    } catch (error) {
      throw new SandboxSetupError(
        'build_failed',
        `Failed to build sandbox image from ${buildContextPath}`,
        error,
      );
    }
  }

  const pullSummary = pullErrors.length > 0 ? pullErrors.join('; ') : 'No pull candidates configured';

  throw new SandboxSetupError(
    buildContextPath ? 'pull_failed' : 'no_strategy',
    buildContextPath
      ? `Could not pull sandbox image (${pullSummary}) and bundled build was not attempted.`
      : `Could not pull sandbox image (${pullSummary}). Provide a bundled build context or build locally with pnpm sandbox:build.`,
    pullErrors,
  );
}
