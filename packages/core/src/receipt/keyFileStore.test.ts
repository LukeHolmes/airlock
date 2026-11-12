import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { generateEd25519KeyMaterial } from './crypto.js';
import {
  assertPrivateKeyFilePermissions,
  loadOrCreateReceiptKey,
  readReceiptKeyFile,
  writeReceiptKeyFile,
} from './keyFileStore.js';

describe('receipt key file store', () => {
  test('creates key with mode 600 on unix', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airlock-receipt-key-'));
    const filePath = path.join(dir, 'airlock-receipt-signing.json');
    writeReceiptKeyFile(filePath, generateEd25519KeyMaterial());
    if (process.platform !== 'win32') {
      assertPrivateKeyFilePermissions(filePath);
      const mode = fs.statSync(filePath).mode & 0o777;
      assert.equal(mode, 0o600);
    }
    const loaded = readReceiptKeyFile(filePath);
    assert.equal(loaded.algorithm, 'Ed25519');
  });

  test('loadOrCreateReceiptKey is idempotent', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airlock-receipt-key-'));
    const first = loadOrCreateReceiptKey(dir);
    const second = loadOrCreateReceiptKey(dir);
    assert.equal(first.publicKeySpki, second.publicKeySpki);
  });
});
