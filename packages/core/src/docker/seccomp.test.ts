import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import {
  AIRLOCK_SECCOMP_PROFILE,
  MOBY_SECCOMP_SOURCE,
  serializeSeccompProfile,
} from './seccomp.js';

const here = dirname(fileURLToPath(import.meta.url));

function syscallSets(profile: typeof AIRLOCK_SECCOMP_PROFILE) {
  const allowed = new Set<string>();
  const denied = new Set<string>();
  for (const rule of profile.syscalls) {
    for (const name of rule.names ?? []) {
      if (rule.action.includes('ALLOW')) allowed.add(name);
      if (rule.action.includes('ERRNO')) denied.add(name);
    }
  }
  return { allowed, denied };
}

describe('AIRLOCK_SECCOMP_PROFILE', () => {
  test('sources Moby upstream, not Dangerzone', () => {
    const sourcePath = join(here, '..', '..', 'src', 'docker', 'seccomp.ts');
    const source = readFileSync(sourcePath, 'utf8');
    assert.match(source, /moby\/moby/);
    assert.doesNotMatch(source, /dangerzone/i);
    assert.equal(MOBY_SECCOMP_SOURCE.includes('v27.4.0'), true);
  });

  test('retains hardening deny rule for vmsplice', () => {
    const { denied } = syscallSets(AIRLOCK_SECCOMP_PROFILE);
    assert.ok(denied.has('vmsplice'));
    assert.ok(denied.has('kexec_load'));
  });

  test('retains ptrace allow for guest compatibility', () => {
    const { allowed } = syscallSets(AIRLOCK_SECCOMP_PROFILE);
    assert.ok(allowed.has('ptrace'));
    assert.ok(allowed.has('execve'));
  });

  test('serialized profile is stable JSON', () => {
    const json = serializeSeccompProfile();
    const parsed = JSON.parse(json) as typeof AIRLOCK_SECCOMP_PROFILE;
    assert.equal(parsed.defaultAction, 'SCMP_ACT_ERRNO');
    assert.ok(parsed.syscalls.length >= 30);
  });
});
