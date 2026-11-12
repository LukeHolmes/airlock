import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { generateEd25519KeyMaterial } from './crypto.js';
import type { KeyProtector } from './keyProtector.js';
import {
  assertPrivateKeyFilePermissions,
  keyFilePath,
  loadSigningKeyMaterial,
  saveSigningKeyMaterial,
  type ReceiptSigningKeyMaterial,
} from './keyRecord.js';

function mockProtector(available: boolean): KeyProtector {
  return {
    isEncryptionAvailable: () => available,
    encryptPrivateKeyPkcs8: (plain) => `mock:${Buffer.from(plain).toString('base64')}`,
    decryptPrivateKeyPkcs8: (payload) => {
      assert.ok(payload.startsWith('mock:'));
      return Buffer.from(payload.slice(5), 'base64').toString('utf8');
    },
  };
}

describe('receipt signing key record', () => {
  test('file-0600 path stores private key with mode 600', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airlock-key-'));
    const filePath = keyFilePath(dir);
    const material: ReceiptSigningKeyMaterial = {
      ...generateEd25519KeyMaterial(),
      createdAt: new Date().toISOString(),
      protectionLevel: 'file-0600',
    };
    saveSigningKeyMaterial(filePath, material, mockProtector(false));
    if (process.platform !== 'win32') {
      assertPrivateKeyFilePermissions(filePath);
    }
    const loaded = loadSigningKeyMaterial(filePath, mockProtector(false));
    assert.equal(loaded.privateKeyPkcs8, material.privateKeyPkcs8);
    assert.equal(loaded.protectionLevel, 'file-0600');
  });

  test('os-keychain path stores encrypted blob only', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airlock-key-'));
    const filePath = keyFilePath(dir);
    const protector = mockProtector(true);
    const material: ReceiptSigningKeyMaterial = {
      ...generateEd25519KeyMaterial(),
      createdAt: new Date().toISOString(),
      protectionLevel: 'os-keychain',
    };
    saveSigningKeyMaterial(filePath, material, protector);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
      privateKeyPkcs8?: string;
      encryptedPrivateKeyPkcs8?: string;
    };
    assert.equal(raw.privateKeyPkcs8, undefined);
    assert.ok(raw.encryptedPrivateKeyPkcs8?.startsWith('mock:'));
    const loaded = loadSigningKeyMaterial(filePath, protector);
    assert.equal(loaded.privateKeyPkcs8, material.privateKeyPkcs8);
  });

  test('migrates v1 plaintext file to v2', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airlock-key-'));
    const filePath = keyFilePath(dir);
    const keys = generateEd25519KeyMaterial();
    fs.writeFileSync(
      filePath,
      `${JSON.stringify({
        version: 1,
        algorithm: 'Ed25519',
        createdAt: new Date().toISOString(),
        privateKeyPkcs8: keys.privateKeyPkcs8,
        publicKeySpki: keys.publicKeySpki,
      })}\n`,
      { mode: 0o600 },
    );
    const loaded = loadSigningKeyMaterial(filePath, mockProtector(true));
    assert.equal(loaded.publicKeySpki, keys.publicKeySpki);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { version: number };
    assert.equal(raw.version, 2);
  });
});
