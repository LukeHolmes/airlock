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

function flatUnrestrictedAllow(profile: typeof AIRLOCK_SECCOMP_PROFILE): Set<string> {
  const allowed = new Set<string>();
  for (const rule of profile.syscalls) {
    if (rule.action !== 'SCMP_ACT_ALLOW') continue;
    if (rule.includes?.caps || rule.includes?.arches) continue;
    if (rule.includes && 'minKernel' in rule.includes) continue;
    if (rule.args?.length) continue;
    for (const name of rule.names ?? []) allowed.add(name);
  }
  return allowed;
}

function prependDenyNames(profile: typeof AIRLOCK_SECCOMP_PROFILE): string[] {
  const first = profile.syscalls[0];
  assert.equal(first?.action, 'SCMP_ACT_ERRNO');
  assert.equal(first?.errnoRet, 1);
  return [...(first.names ?? [])];
}

describe('AIRLOCK_SECCOMP_PROFILE', () => {
  test('documents Moby v27.4.0 upstream', () => {
    const sourcePath = join(here, '..', '..', 'src', 'docker', 'seccomp.ts');
    const source = readFileSync(sourcePath, 'utf8');
    assert.match(source, /moby\/moby/);
    assert.doesNotMatch(source, /dangerzone/i);
    assert.equal(MOBY_SECCOMP_SOURCE.includes('v27.4.0'), true);
  });

  test('does not grant gVisor-era flat allows beyond Moby', () => {
    const moby = JSON.parse(
      readFileSync(join(here, 'seccomp', 'moby-default.v27.4.0.json'), 'utf8'),
    ) as typeof AIRLOCK_SECCOMP_PROFILE;
    const mobyFlat = flatUnrestrictedAllow(moby);
    const airFlat = flatUnrestrictedAllow(AIRLOCK_SECCOMP_PROFILE);
    const extras = [...airFlat].filter((name) => !mobyFlat.has(name));
    assert.deepEqual(extras, [], `unexpected flat allows beyond Moby: ${extras.join(', ')}`);
    for (const forbidden of ['keyctl', 'pivot_root', 'signal', 'query_module']) {
      assert.equal(airFlat.has(forbidden), false, `must not allow ${forbidden}`);
    }
  });

  test('prepends Airlock EPERM deny list stricter than Moby baseline', () => {
    const denied = prependDenyNames(AIRLOCK_SECCOMP_PROFILE);
    assert.ok(denied.includes('vmsplice'));
    assert.ok(denied.includes('cachestat'));
    assert.ok(denied.includes('kexec_load'));
    const moby = JSON.parse(
      readFileSync(join(here, 'seccomp', 'moby-default.v27.4.0.json'), 'utf8'),
    ) as typeof AIRLOCK_SECCOMP_PROFILE;
    const mobyFlat = flatUnrestrictedAllow(moby);
    for (const name of ['vmsplice', 'cachestat', 'futex_wake', 'io_pgetevents']) {
      assert.ok(denied.includes(name));
      assert.ok(mobyFlat.has(name));
    }
  });

  test('serialized profile stays Moby-shaped defaultAction', () => {
    const json = serializeSeccompProfile();
    const parsed = JSON.parse(json) as typeof AIRLOCK_SECCOMP_PROFILE;
    assert.equal(parsed.defaultAction, 'SCMP_ACT_ERRNO');
    assert.equal(parsed.defaultErrnoRet, 1);
    assert.ok(parsed.syscalls.length >= 40);
  });
});
