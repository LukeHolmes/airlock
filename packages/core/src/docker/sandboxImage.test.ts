import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  configureSandboxImage,
  getGhcrSandboxImageRef,
  getSandboxImageCandidates,
  getSandboxImageConfig,
  isBundledBuildContext,
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
    ghcrOwner: 'LukeHolmes',
  });
});

test('getGhcrSandboxImageRef uses configured owner and version', () => {
  configureSandboxImage({ appVersion: '0.3.1', ghcrOwner: 'LukeHolmes' });

  assert.equal(getGhcrSandboxImageRef(), 'ghcr.io/LukeHolmes/airlock-sandbox:0.3.1');
  assert.equal(getGhcrSandboxImageRef('0.4.0'), 'ghcr.io/LukeHolmes/airlock-sandbox:0.4.0');
});

test('getSandboxImageCandidates prioritizes env override then GHCR ref', () => {
  configureSandboxImage({ appVersion: '0.3.1', ghcrOwner: 'LukeHolmes' });
  process.env.AIRLOCK_SANDBOX_IMAGE = 'registry.example.com/airlock:dev';

  assert.deepEqual(getSandboxImageCandidates(), [
    'registry.example.com/airlock:dev',
    'ghcr.io/LukeHolmes/airlock-sandbox:0.3.1',
  ]);
});

test('getSandboxImageCandidates deduplicates identical refs', () => {
  configureSandboxImage({ appVersion: '0.3.1', ghcrOwner: 'LukeHolmes' });
  process.env.AIRLOCK_SANDBOX_IMAGE = 'ghcr.io/LukeHolmes/airlock-sandbox:0.3.1';

  assert.deepEqual(getSandboxImageCandidates(), ['ghcr.io/LukeHolmes/airlock-sandbox:0.3.1']);
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
