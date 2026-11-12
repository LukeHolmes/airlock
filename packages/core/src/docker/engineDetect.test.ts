import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { classifyEngineKind, listEngineConnectionCandidates } from './engineDetect.js';

describe('engineDetect', () => {
  test('classifyEngineKind distinguishes common engines', () => {
    assert.equal(
      classifyEngineKind({ ServerVersion: '5.0.0-podman', Name: 'host' } as never),
      'podman',
    );
    assert.equal(
      classifyEngineKind({ ServerVersion: '27.4.0', OperatingSystem: 'OrbStack' } as never),
      'orbstack',
    );
    assert.equal(
      classifyEngineKind({ ServerVersion: '26.0.0', Name: 'colima' } as never),
      'colima',
    );
    assert.equal(
      classifyEngineKind({
        ServerVersion: '26.0.0',
        OperatingSystem: 'Rancher Desktop WSL',
      } as never),
      'rancher-desktop',
    );
    assert.equal(
      classifyEngineKind({ ServerVersion: '27.0.0', Name: 'docker' } as never),
      'docker',
    );
  });

  test('listEngineConnectionCandidates deduplicates sockets', () => {
    const list = listEngineConnectionCandidates();
    const keys = list.map((c) => c.host ?? c.socketPath ?? c.label);
    assert.equal(keys.length, new Set(keys).size);
  });
});
