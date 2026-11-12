/**
 * Central defaults for Airlock-managed container resource and tmpfs limits.
 * Override via environment for controlled experiments only (not UI-exposed in M0).
 */

const MIB = 1024 * 1024;

export const CONTAINER_MEMORY_BYTES = parsePositiveInt(process.env.AIRLOCK_CONTAINER_MEMORY_MB, 2048) * MIB;

/** memory-swap == memory disables extra swap (Docker semantics). */
export const CONTAINER_MEMORY_SWAP_BYTES = parsePositiveInt(
  process.env.AIRLOCK_CONTAINER_MEMORY_SWAP_MB,
  CONTAINER_MEMORY_BYTES / MIB,
) * MIB;

export const CONTAINER_NANO_CPUS = parsePositiveInt(process.env.AIRLOCK_CONTAINER_CPUS, 2) * 1_000_000_000;

export const CONTAINER_PIDS_LIMIT = parsePositiveInt(process.env.AIRLOCK_CONTAINER_PIDS_LIMIT, 256);

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const value = Number(raw.trim());
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

const AIRLOCK_UID = 1000;
const AIRLOCK_GID = 1000;

const userTmpfs = (sizeMb: number, mode = '0700'): string =>
  `rw,noexec,nosuid,nodev,size=${sizeMb}m,uid=${AIRLOCK_UID},gid=${AIRLOCK_GID},mode=${mode}`;

/** Writable scratch paths for viewers under a read-only rootfs (nodev,noexec,nosuid, uid 1000). */
export const DEFAULT_CONTAINER_TMPFS: Record<string, string> = {
  '/tmp': `rw,noexec,nosuid,nodev,size=512m,mode=1777,uid=0,gid=0`,
  '/var/tmp': `rw,noexec,nosuid,nodev,size=100m,mode=1777,uid=0,gid=0`,
  '/home/airlock/.cache': userTmpfs(256),
  '/home/airlock/.config': userTmpfs(64),
  '/home/airlock/.vnc': userTmpfs(32),
  '/home/airlock/.local': userTmpfs(64),
};
