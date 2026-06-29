import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import { RuntimeNotFoundError, detectRuntimeSocket } from './runtime.js';

test('RuntimeNotFoundError sets name and message', () => {
  const err = new RuntimeNotFoundError('AIRLOCK_NO_RUNTIME: test');
  assert.equal(err.name, 'RuntimeNotFoundError');
  assert.equal(err.message, 'AIRLOCK_NO_RUNTIME: test');
  assert.ok(err instanceof Error);
});

test('detectRuntimeSocket returns podman or docker when a socket exists, else throws', () => {
  const hasRuntimeSocket = [
    `${process.env.HOME}/.local/share/containers/podman/machine/podman.sock`,
    `${process.env.HOME}/.local/share/containers/podman/machine/qemu/podman.sock`,
    `/run/user/${process.getuid?.() ?? 1000}/podman/podman.sock`,
    `/tmp/podman-run-${process.getuid?.() ?? 1000}/podman/podman.sock`,
    '/var/run/docker.sock',
    `${process.env.HOME}/.docker/run/docker.sock`,
  ].some((candidate) => existsSync(candidate));

  if (hasRuntimeSocket) {
    const detected = detectRuntimeSocket();
    assert.ok(detected.runtime === 'podman' || detected.runtime === 'docker');
    assert.ok(detected.socketPath.length > 0);
    return;
  }

  assert.throws(() => detectRuntimeSocket(), RuntimeNotFoundError);
});
