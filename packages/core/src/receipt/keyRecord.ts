import fs from 'node:fs';
import path from 'node:path';
import { generateEd25519KeyMaterial, type Ed25519KeyMaterial } from './crypto.js';
import type { KeyProtector, ReceiptKeyProtectionLevel } from './keyProtector.js';

export const RECEIPT_KEY_FILE_NAME = 'airlock-receipt-signing.json';
export const LEGACY_RECEIPT_KEY_FILE_NAME = 'airlock-receipt-signing.v1.json';

const PRIVATE_KEY_MODE = 0o600;

export type ReceiptKeyFileV1 = {
  version: 1;
  algorithm: 'Ed25519';
  createdAt: string;
  privateKeyPkcs8: string;
  publicKeySpki: string;
};

export type ReceiptKeyFileV2 = {
  version: 2;
  algorithm: 'Ed25519';
  protection: ReceiptKeyProtectionLevel;
  createdAt: string;
  publicKeySpki: string;
  encryptedPrivateKeyPkcs8?: string;
  privateKeyPkcs8?: string;
};

export type ReceiptSigningKeyMaterial = Ed25519KeyMaterial & {
  protectionLevel: ReceiptKeyProtectionLevel;
  createdAt: string;
};

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
    throw new Error(`Receipt key file must be mode 600 (found ${mode.toString(8)})`);
  }
}

function writeKeyFileV2(filePath: string, record: ReceiptKeyFileV2): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, {
    encoding: 'utf8',
    mode: PRIVATE_KEY_MODE,
  });
  assertPrivateKeyFilePermissions(filePath);
}

function parseStoredRecord(raw: string): ReceiptKeyFileV1 | ReceiptKeyFileV2 {
  const parsed = JSON.parse(raw) as ReceiptKeyFileV1 | ReceiptKeyFileV2;
  if (parsed.algorithm !== 'Ed25519' || !parsed.publicKeySpki) {
    throw new Error('Invalid receipt key file');
  }
  return parsed;
}

function materialFromV2(
  record: ReceiptKeyFileV2,
  protector: KeyProtector,
): ReceiptSigningKeyMaterial {
  let privateKeyPkcs8: string;
  if (record.protection === 'os-keychain') {
    if (!record.encryptedPrivateKeyPkcs8) {
      throw new Error('Missing encrypted private key blob');
    }
    privateKeyPkcs8 = protector.decryptPrivateKeyPkcs8(record.encryptedPrivateKeyPkcs8);
  } else {
    if (!record.privateKeyPkcs8) {
      throw new Error('Missing private key in file-0600 store');
    }
    privateKeyPkcs8 = record.privateKeyPkcs8;
  }
  return {
    privateKeyPkcs8,
    publicKeySpki: record.publicKeySpki,
    protectionLevel: record.protection,
    createdAt: record.createdAt,
  };
}

function migrateV1Plaintext(
  filePath: string,
  v1: ReceiptKeyFileV1,
  protector: KeyProtector,
): ReceiptSigningKeyMaterial {
  const material: ReceiptSigningKeyMaterial = {
    privateKeyPkcs8: v1.privateKeyPkcs8,
    publicKeySpki: v1.publicKeySpki,
    createdAt: v1.createdAt,
    protectionLevel: protector.isEncryptionAvailable() ? 'os-keychain' : 'file-0600',
  };
  saveSigningKeyMaterial(filePath, material, protector);
  const legacyPath = path.join(path.dirname(filePath), LEGACY_RECEIPT_KEY_FILE_NAME);
  fs.writeFileSync(legacyPath, JSON.stringify({ migratedAt: new Date().toISOString() }), {
    mode: PRIVATE_KEY_MODE,
  });
  return material;
}

export function saveSigningKeyMaterial(
  filePath: string,
  material: ReceiptSigningKeyMaterial,
  protector: KeyProtector,
): void {
  if (material.protectionLevel === 'os-keychain') {
    if (!protector.isEncryptionAvailable()) {
      throw new Error('OS keychain encryption requested but unavailable');
    }
    const record: ReceiptKeyFileV2 = {
      version: 2,
      algorithm: 'Ed25519',
      protection: 'os-keychain',
      createdAt: material.createdAt,
      publicKeySpki: material.publicKeySpki,
      encryptedPrivateKeyPkcs8: protector.encryptPrivateKeyPkcs8(material.privateKeyPkcs8),
    };
    writeKeyFileV2(filePath, record);
    return;
  }

  const record: ReceiptKeyFileV2 = {
    version: 2,
    algorithm: 'Ed25519',
    protection: 'file-0600',
    createdAt: material.createdAt,
    publicKeySpki: material.publicKeySpki,
    privateKeyPkcs8: material.privateKeyPkcs8,
  };
  writeKeyFileV2(filePath, record);
}

export function loadSigningKeyMaterial(
  filePath: string,
  protector: KeyProtector,
): ReceiptSigningKeyMaterial {
  if (!fs.existsSync(filePath)) {
    const generated = generateEd25519KeyMaterial();
    const material: ReceiptSigningKeyMaterial = {
      ...generated,
      createdAt: new Date().toISOString(),
      protectionLevel: protector.isEncryptionAvailable() ? 'os-keychain' : 'file-0600',
    };
    saveSigningKeyMaterial(filePath, material, protector);
    return material;
  }

  assertPrivateKeyFilePermissions(filePath);
  const record = parseStoredRecord(fs.readFileSync(filePath, 'utf8'));

  if (record.version === 1) {
    return migrateV1Plaintext(filePath, record, protector);
  }

  return materialFromV2(record, protector);
}

export function readPublicKeySpkiFromFile(filePath: string): string {
  const record = parseStoredRecord(fs.readFileSync(filePath, 'utf8'));
  return record.publicKeySpki;
}
