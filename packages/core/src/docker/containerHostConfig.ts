import type Dockerode from 'dockerode';

import {
  CONTAINER_MEMORY_BYTES,
  CONTAINER_MEMORY_SWAP_BYTES,
  CONTAINER_NANO_CPUS,
  CONTAINER_PIDS_LIMIT,
  DEFAULT_CONTAINER_TMPFS,
} from './containerDefaults.js';
import { resolveOptionalContainerRuntime } from './containerRuntime.js';
import { serializeSeccompProfile } from './seccomp.js';

export type AirlockHostConfigInput = {
  networkMode: string;
  binds: string[];
  /** Merge overrides for tmpfs (e.g. tests); defaults include viewer scratch paths. */
  tmpfs?: Record<string, string>;
};

function getSeccompSecurityOpt(): string {
  return `seccomp=${serializeSeccompProfile()}`;
}

/**
 * Build the Docker HostConfig with Airlock M0 defaults: limits, caps, seccomp,
 * read-only rootfs, and bounded tmpfs mounts.
 */
export function buildAirlockHostConfig(
  input: AirlockHostConfigInput,
): NonNullable<Dockerode.ContainerCreateOptions['HostConfig']> {
  const tmpfs = { ...DEFAULT_CONTAINER_TMPFS, ...input.tmpfs };
  const securityOpt: string[] = ['no-new-privileges', getSeccompSecurityOpt()];

  const hostConfig: NonNullable<Dockerode.ContainerCreateOptions['HostConfig']> = {
    NetworkMode: input.networkMode,
    CapDrop: ['ALL'],
    SecurityOpt: securityOpt,
    Binds: input.binds,
    Tmpfs: tmpfs,
    AutoRemove: true,
    ReadonlyRootfs: true,
    Memory: CONTAINER_MEMORY_BYTES,
    MemorySwap: CONTAINER_MEMORY_SWAP_BYTES,
    NanoCpus: CONTAINER_NANO_CPUS,
    PidsLimit: CONTAINER_PIDS_LIMIT,
  };

  const runtime = resolveOptionalContainerRuntime();
  if (runtime) {
    hostConfig.Runtime = runtime;
  }

  return hostConfig;
}

/** @internal exported for assertions in unit tests */
export function getAirlockHostConfigSnapshot(): {
  memoryBytes: number;
  memorySwapBytes: number;
  nanoCpus: number;
  pidsLimit: number;
  tmpfsPaths: string[];
  readonlyRootfs: boolean;
  capDrop: string[];
} {
  const sample = buildAirlockHostConfig({ networkMode: 'none', binds: [] });
  return {
    memoryBytes: sample.Memory ?? 0,
    memorySwapBytes: sample.MemorySwap ?? 0,
    nanoCpus: sample.NanoCpus ?? 0,
    pidsLimit: sample.PidsLimit ?? 0,
    tmpfsPaths: Object.keys(sample.Tmpfs ?? {}),
    readonlyRootfs: sample.ReadonlyRootfs === true,
    capDrop: sample.CapDrop ?? [],
  };
}
