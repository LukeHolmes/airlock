/**
 * Airlock container seccomp profile (Docker OCI JSON).
 *
 * Upstream basis: Moby default container profile
 * https://github.com/moby/moby/blob/v27.4.0/profiles/seccomp/default.json
 * (Apache-2.0, moby/moby).
 *
 * The on-disk `seccomp/airlock.profile.json` was reconciled from that upstream
 * with Airlock-specific deny/allow adjustments for KasmVNC, supervisord,
 * Chromium, Evince, LibreOffice, and offline triage tools (see
 * `seccomp/PROFILE.md`). Effective syscall posture matches the pre-cleanup
 * profile (no CapDrop/seccomp loosening).
 */

import airlockProfile from './seccomp/airlock.profile.json' with { type: 'json' };

export interface SeccompArg {
  index: number;
  value: number;
  valueTwo: number;
  op: string;
}

export interface SeccompRule {
  names: string[];
  action: string;
  args?: SeccompArg[];
  comment?: string;
  includes?: {
    arches?: string[];
    caps?: string[];
  };
  excludes?: {
    caps?: string[];
  };
  errnoRet?: number;
  errno?: string;
}

export interface SeccompArch {
  architecture: string;
  subArchitectures: string[];
}

export interface SeccompProfile {
  defaultAction: string;
  defaultErrnoRet: number;
  defaultErrno: string;
  archMap: SeccompArch[];
  syscalls: SeccompRule[];
}

export const MOBY_SECCOMP_SOURCE =
  'https://github.com/moby/moby/blob/v27.4.0/profiles/seccomp/default.json';

export const AIRLOCK_SECCOMP_PROFILE = airlockProfile as SeccompProfile;

export function serializeSeccompProfile(): string {
  return JSON.stringify(AIRLOCK_SECCOMP_PROFILE);
}
