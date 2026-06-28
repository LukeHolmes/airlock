import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import {
  configureSandboxImage,
  getGhcrSandboxImageRef,
  getSandboxImageCandidates,
  getSandboxImageConfig,
  isBundledBuildContext,
  isSandboxBuildContext,
  resolveSandboxContextFromCandidates,
  SANDBOX_BUILD_FILES,
} from './sandboxImage.js';

const originalEnv = {
  AIRLOCK_SANDBOX_IMAGE: process.env.AIRLOCK_SANDBOX_IMAGE,
  AIRLOCK_APP_VERSION: process.env.AIRLOCK_APP_VERSION,
  AIRLOCK_GHCR_OWNER: process.env.AIRLOCK_GHCR_OWNER,
};

afterEach(() => {
  if (originalEnv.AIRLOCK_SANDBOX_IMAGE === undefined) {
    delete process.env.AIRLOCK_SANDBOX_IMAGE;
  } else {
    process.env.AIRLOCK_SANDBOX_IMAGE = originalEnv.AIRLOCK_SANDBOX_IMAGE;
  }

  if (originalEnv.AIRLOCK_APP_VERSION === undefined) {
    delete process.env.AIRLOCK_APP_VERSION;
  } else {
    process.env.AIRLOCK_APP_VERSION = originalEnv.AIRLOCK_APP_VERSION;
  }

  if (originalEnv.AIRLOCK_GHCR_OWNER === undefined) {
    delete process.env.AIRLOCK_GHCR_OWNER;
  } else {
    process.env.AIRLOCK_GHCR_OWNER = originalEnv.AIRLOCK_GHCR_OWNER;
  }

  configureSandboxImage({
    appVersion: '0.3.1',
    ghcrOwner: 'lukeholmes',
  });
});

test('getGhcrSandboxImageRef uses configured owner and version', () => {
  configureSandboxImage({ appVersion: '0.3.1', ghcrOwner: 'LukeHolmes' });

  assert.equal(getGhcrSandboxImageRef(), 'ghcr.io/lukeholmes/airlock-sandbox:0.3.1');
  assert.equal(getGhcrSandboxImageRef('0.4.0'), 'ghcr.io/lukeholmes/airlock-sandbox:0.4.0');
});

test('getSandboxImageCandidates prioritizes env override then GHCR ref', () => {
  configureSandboxImage({ appVersion: '0.3.1', ghcrOwner: 'lukeholmes' });
  process.env.AIRLOCK_SANDBOX_IMAGE = 'registry.example.com/airlock:dev';

  assert.deepEqual(getSandboxImageCandidates(), [
    'registry.example.com/airlock:dev',
    'ghcr.io/lukeholmes/airlock-sandbox:0.3.1',
  ]);
});

test('getSandboxImageCandidates deduplicates identical refs', () => {
  configureSandboxImage({ appVersion: '0.3.1', ghcrOwner: 'lukeholmes' });
  process.env.AIRLOCK_SANDBOX_IMAGE = 'ghcr.io/lukeholmes/airlock-sandbox:0.3.1';

  assert.deepEqual(getSandboxImageCandidates(), ['ghcr.io/lukeholmes/airlock-sandbox:0.3.1']);
});

test('configureSandboxImage updates runtime config', () => {
  configureSandboxImage({ appVersion: '9.9.9', ghcrOwner: 'airlock-dev' });

  assert.deepEqual(getSandboxImageConfig(), {
    appVersion: '9.9.9',
    ghcrOwner: 'airlock-dev',
  });
});

test('isBundledBuildContext returns false for missing paths', () => {
  assert.equal(isBundledBuildContext('/tmp/airlock-missing-context'), false);
});

test('isSandboxBuildContext requires all sandbox build files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'airlock-sandbox-context-'));
  try {
    assert.equal(isSandboxBuildContext(dir), false);

    for (const file of SANDBOX_BUILD_FILES) {
      writeFileSync(join(dir, file), file === 'Dockerfile' ? 'FROM scratch\n' : '# test\n');
    }

    assert.equal(isSandboxBuildContext(dir), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveSandboxContextFromCandidates returns first complete context', () => {
  const dir = mkdtempSync(join(tmpdir(), 'airlock-sandbox-resolve-'));
  try {
    for (const file of SANDBOX_BUILD_FILES) {
      writeFileSync(join(dir, file), '# test\n');
    }

    assert.equal(resolveSandboxContextFromCandidates(['/missing', dir]), dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
