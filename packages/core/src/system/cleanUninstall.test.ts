import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { isManagedAirlockLabels, MANAGED_LABEL } from '../docker/containerLifecycle.js';
import { wipeAirlockUserData } from './cleanUninstall.js';

test('isManagedAirlockLabels does not match unrelated containers', () => {
  assert.equal(isManagedAirlockLabels({}), false);
  assert.equal(isManagedAirlockLabels({ some: 'label' }), false);
  assert.equal(isManagedAirlockLabels({ [MANAGED_LABEL]: 'false' }), false);
  assert.equal(isManagedAirlockLabels({ [MANAGED_LABEL]: 'true' }), true);
});

test('wipeAirlockUserData removes only userData children', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airlock-userdata-'));
  const keyPath = path.join(root, 'airlock-receipt-signing.json');
  const keepParent = root;
  fs.writeFileSync(keyPath, '{"version":2}', 'utf8');
  fs.mkdirSync(path.join(root, 'Cache', 'sub'), { recursive: true });
  fs.writeFileSync(path.join(root, 'Cache', 'sub', 'x'), 'y', 'utf8');

  const { removed, failed } = wipeAirlockUserData(root);
  assert.equal(failed.length, 0);
  assert.ok(removed.length >= 2);
  assert.equal(fs.existsSync(keyPath), false);
  assert.equal(fs.existsSync(path.join(root, 'Cache')), false);
  assert.equal(fs.existsSync(keepParent), true);
  assert.equal(fs.readdirSync(root).length, 0);

  fs.rmSync(root, { recursive: true, force: true });
});
