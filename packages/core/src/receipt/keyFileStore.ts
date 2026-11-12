import fs from 'node:fs';
import path from 'node:path';
import {
  generateEd25519KeyMaterial,
  publicKeyFingerprintFromSpki,
  type Ed25519KeyMaterial,
} from './crypto.js';

export const RECEIPT_KEY_FILE_NAME = 'airlock-receipt-signing.json';

export type ReceiptKeyFile = {
  version: 1;
  algorithm: 'Ed25519';
  createdAt: string;
  privateKeyPkcs8: string;
  publicKeySpki: string;
};

const PRIVATE_KEY_MODE = 0o600;

export function keyFilePath(userDataDir: string): string {
  return path.join(userDataDir, RECEIPT_KEY_FILE_NAME);
}

export function assertPrivateKeyFilePermissions(filePath: string): void {
  if (process.platform === 'win32') {
    return;
  }
  const stat = fs.statSync(filePath);
  const mode = stat.mode & 0o777;
  if (mode !== PRIVATE_KEY_MODE) {
    throw new Error(`Receipt private key file must be mode 600 (found ${mode.toString(8)})`);
  }
}

export function writeReceiptKeyFile(
  filePath: string,
  material: Ed25519KeyMaterial,
): ReceiptKeyFile {
  const record: ReceiptKeyFile = {
    version: 1,
    algorithm: 'Ed25519',
    createdAt: new Date().toISOString(),
    privateKeyPkcs8: material.privateKeyPkcs8,
    publicKeySpki: material.publicKeySpki,
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, {
    encoding: 'utf8',
    mode: PRIVATE_KEY_MODE,
  });
  assertPrivateKeyFilePermissions(filePath);
  return record;
}

export function readReceiptKeyFile(filePath: string): ReceiptKeyFile {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as ReceiptKeyFile;
  if (parsed.algorithm !== 'Ed25519' || !parsed.privateKeyPkcs8 || !parsed.publicKeySpki) {
    throw new Error('Invalid receipt key file');
  }
  assertPrivateKeyFilePermissions(filePath);
  return parsed;
}

export function loadOrCreateReceiptKey(userDataDir: string): ReceiptKeyFile {
  const filePath = keyFilePath(userDataDir);
  if (fs.existsSync(filePath)) {
    return readReceiptKeyFile(filePath);
  }
  return writeReceiptKeyFile(filePath, generateEd25519KeyMaterial());
}

export function exportPublicKeyDocument(keyFile: ReceiptKeyFile): {
  algorithm: 'Ed25519';
  publicKeySpki: string;
  fingerprint: string;
  createdAt: string;
} {
  return {
    algorithm: 'Ed25519',
    publicKeySpki: keyFile.publicKeySpki,
    fingerprint: publicKeyFingerprintFromSpki(keyFile.publicKeySpki),
    createdAt: keyFile.createdAt,
  };
}
