import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isRemovableAirlockSandboxImageRef } from './airlockImageRefs.js';

test('isRemovableAirlockSandboxImageRef allows only Airlock sandbox repos', () => {
  assert.equal(isRemovableAirlockSandboxImageRef('airlock/sandbox:latest'), true);
  assert.equal(isRemovableAirlockSandboxImageRef('ghcr.io/lukeholmes/airlock-sandbox:0.4.1'), true);
  assert.equal(
    isRemovableAirlockSandboxImageRef('ghcr.io/lukeholmes/airlock-sandbox@sha256:abc'),
    true,
  );

  assert.equal(isRemovableAirlockSandboxImageRef('nginx:latest'), false);
  assert.equal(isRemovableAirlockSandboxImageRef('ghcr.io/other/airlock-sandbox:latest'), false);
  assert.equal(isRemovableAirlockSandboxImageRef('alpine:3.21'), false);
  assert.equal(isRemovableAirlockSandboxImageRef('airlock/other:latest'), false);
});
