import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  isManagedAirlockLabels,
  isProcessAlive,
  isReclaimableManagedContainer,
  parseOwnerPid,
  MANAGED_LABEL,
  OWNER_PID_LABEL,
} from './containerLifecycle.js';

describe('containerLifecycle ownership', () => {
  test('parseOwnerPid accepts valid integers only', () => {
    assert.equal(parseOwnerPid({ [OWNER_PID_LABEL]: String(process.pid) }), process.pid);
    assert.equal(parseOwnerPid({ [OWNER_PID_LABEL]: '0' }), undefined);
    assert.equal(parseOwnerPid({}), undefined);
  });

  test('isManagedAirlockLabels requires managed markers', () => {
    assert.equal(isManagedAirlockLabels({ [MANAGED_LABEL]: 'true' }), true);
    assert.equal(isManagedAirlockLabels({ airlock_session: 'true' }), true);
    assert.equal(isManagedAirlockLabels({}), false);
  });

  test('isReclaimableManagedContainer respects live foreign owners', () => {
    const currentPid = process.pid;
    const deadPid = 2_147_483_647;

    assert.equal(
      isReclaimableManagedContainer(
        { [MANAGED_LABEL]: 'true', [OWNER_PID_LABEL]: String(currentPid) },
        currentPid,
      ),
      true,
    );

    assert.equal(
      isReclaimableManagedContainer(
        { [MANAGED_LABEL]: 'true', [OWNER_PID_LABEL]: String(deadPid) },
        currentPid,
      ),
      true,
    );

    assert.equal(
      isReclaimableManagedContainer(
        { [MANAGED_LABEL]: 'true', [OWNER_PID_LABEL]: String(process.pid) },
        process.pid + 1,
      ),
      false,
    );
  });

  test('isProcessAlive reflects the current process', () => {
    assert.equal(isProcessAlive(process.pid), true);
    assert.equal(isProcessAlive(2_147_483_647), false);
  });
});
