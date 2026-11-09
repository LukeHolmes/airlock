import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  deriveFirstRunStages,
  mapProgressPhaseToStageId,
  parseSandboxSetupFailure,
  shouldAppendProgressDetail,
  userMessageForSandboxSetupError,
} from './sandboxSetupUi.js';

test('mapProgressPhaseToStageId maps setup phases to UI stages', () => {
  assert.equal(mapProgressPhaseToStageId('checking'), 'checking-docker');
  assert.equal(mapProgressPhaseToStageId('pulling'), 'preparing-image');
  assert.equal(mapProgressPhaseToStageId('building'), 'preparing-image');
  assert.equal(mapProgressPhaseToStageId('tagging'), 'preparing-image');
  assert.equal(mapProgressPhaseToStageId('ready'), 'ready');
});

test('deriveFirstRunStages marks earlier stages complete while pulling', () => {
  const stages = deriveFirstRunStages(
    { phase: 'pulling', message: 'Pulling ghcr.io/lukeholmes/airlock-sandbox:0.4.0' },
    null,
  );

  assert.deepEqual(
    stages.map((s) => s.state),
    ['complete', 'active', 'pending'],
  );
});

test('deriveFirstRunStages marks all complete on ready', () => {
  const stages = deriveFirstRunStages(
    { phase: 'ready', message: 'airlock/sandbox:latest is ready' },
    null,
  );

  assert.deepEqual(
    stages.map((s) => s.state),
    ['complete', 'complete', 'complete'],
  );
});

test('deriveFirstRunStages flags active stage on failure during pull', () => {
  const failure = userMessageForSandboxSetupError('pull_failed', 'pull failed');
  const stages = deriveFirstRunStages({ phase: 'pulling', message: 'Pulling image' }, failure);

  assert.equal(stages[1]?.state, 'error');
});

test('shouldAppendProgressDetail deduplicates identical detail lines', () => {
  const prev = {
    phase: 'pulling' as const,
    message: 'Pulling',
    detail: 'Download complete',
  };
  const same = { ...prev };
  const next = { phase: 'pulling' as const, message: 'Pulling', detail: 'Extracting' };

  assert.equal(shouldAppendProgressDetail(prev, same), false);
  assert.equal(shouldAppendProgressDetail(prev, next), true);
  assert.equal(shouldAppendProgressDetail(null, next), true);
});

test('userMessageForSandboxSetupError returns docker_unavailable copy', () => {
  const result = userMessageForSandboxSetupError('docker_unavailable', 'ignored');
  assert.equal(result.code, 'docker_unavailable');
  assert.match(result.message, /Docker/);
  assert.equal(result.canRetry, true);
});

test('parseSandboxSetupFailure recognizes structured IPC errors', () => {
  const parsed = parseSandboxSetupFailure({
    name: 'SandboxSetupError',
    code: 'docker_unavailable',
    message: 'Docker is not available.',
  });
  assert.equal(parsed.code, 'docker_unavailable');
  assert.match(parsed.message, /not running/i);
});
