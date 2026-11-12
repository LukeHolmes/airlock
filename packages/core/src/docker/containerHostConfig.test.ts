import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import {
  CONTAINER_MEMORY_BYTES,
  CONTAINER_MEMORY_SWAP_BYTES,
  CONTAINER_NANO_CPUS,
  CONTAINER_PIDS_LIMIT,
  DEFAULT_CONTAINER_TMPFS,
} from './containerDefaults.js';
import { buildAirlockHostConfig, getAirlockHostConfigSnapshot } from './containerHostConfig.js';
import { AIRLOCK_CONTAINER_RUNTIME_ENV } from './containerRuntime.js';
import { AIRLOCK_SECCOMP_PROFILE } from './seccomp.js';

describe('buildAirlockHostConfig', () => {
  afterEach(() => {
    delete process.env[AIRLOCK_CONTAINER_RUNTIME_ENV];
  });

  test('applies resource limits and security flags', () => {
    const hostConfig = buildAirlockHostConfig({
      networkMode: 'none',
      binds: ['/host/file.pdf:/home/airlock/workspace/input/target.pdf:ro'],
    });

    assert.deepEqual(hostConfig.CapDrop, ['ALL']);
    assert.equal(hostConfig.ReadonlyRootfs, true);
    assert.equal(hostConfig.Memory, CONTAINER_MEMORY_BYTES);
    assert.equal(hostConfig.MemorySwap, CONTAINER_MEMORY_SWAP_BYTES);
    assert.equal(hostConfig.NanoCpus, CONTAINER_NANO_CPUS);
    assert.equal(hostConfig.PidsLimit, CONTAINER_PIDS_LIMIT);
    const securityOpt = hostConfig.SecurityOpt as string[] | undefined;
    assert.ok(securityOpt?.includes('no-new-privileges'));
    const seccompOpt = securityOpt?.find((opt) => opt.startsWith('seccomp='));
    if (!seccompOpt) {
      assert.fail('seccomp security opt missing');
    }
    const embedded = seccompOpt.slice('seccomp='.length);
    const parsed = JSON.parse(embedded) as typeof AIRLOCK_SECCOMP_PROFILE;
    assert.equal(parsed.syscalls[0]?.errnoRet, 1);
    assert.ok(parsed.syscalls[0]?.names?.includes('vmsplice'));
    const flatAllow = new Set<string>();
    for (const rule of parsed.syscalls) {
      if (
        rule.action === 'SCMP_ACT_ALLOW' &&
        !rule.includes?.caps &&
        !rule.includes?.arches &&
        !rule.args?.length
      ) {
        for (const name of rule.names ?? []) flatAllow.add(name);
      }
    }
    assert.equal(flatAllow.has('keyctl'), false);
    assert.equal(flatAllow.has('pivot_root'), false);
    assert.equal(hostConfig.AutoRemove, true);
  });

  test('tmpfs defaults include viewer scratch paths with nodev and size caps', () => {
    const hostConfig = buildAirlockHostConfig({ networkMode: 'none', binds: [] });
    const tmpfs = hostConfig.Tmpfs ?? {};

    for (const [mount, options] of Object.entries(DEFAULT_CONTAINER_TMPFS)) {
      assert.equal(tmpfs[mount], options);
      assert.match(options, /noexec/);
      assert.match(options, /nosuid/);
      assert.match(options, /nodev/);
      assert.match(options, /size=\d+m/);
    }

    assert.ok(tmpfs['/home/airlock/.cache']);
    assert.ok(tmpfs['/home/airlock/.config']);
    assert.ok(tmpfs['/tmp'].includes('512m'));
  });

  test('snapshot helper matches builder output', () => {
    const snap = getAirlockHostConfigSnapshot();
    assert.equal(snap.readonlyRootfs, true);
    assert.equal(snap.memoryBytes, CONTAINER_MEMORY_BYTES);
    assert.equal(snap.pidsLimit, CONTAINER_PIDS_LIMIT);
    assert.ok(snap.tmpfsPaths.includes('/home/airlock/.cache'));
  });

  test('does not set runtime unless AIRLOCK_RUNTIME=runsc and runsc is registered', () => {
    process.env[AIRLOCK_CONTAINER_RUNTIME_ENV] = 'runsc';
    const hostConfig = buildAirlockHostConfig({ networkMode: 'none', binds: [] });
    // In CI without gVisor, resolveOptionalContainerRuntime returns undefined.
    if (hostConfig.Runtime) {
      assert.equal(hostConfig.Runtime, 'runsc');
    }
  });
});
