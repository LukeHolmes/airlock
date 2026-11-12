import { publicKeyFingerprintFromSpki } from './crypto.js';
import type { KeyProtector } from './keyProtector.js';
import {
  RECEIPT_KEY_FILE_NAME,
  assertPrivateKeyFilePermissions,
  keyFilePath,
  loadSigningKeyMaterial,
  readPublicKeySpkiFromFile,
  type ReceiptSigningKeyMaterial,
} from './keyRecord.js';

export { RECEIPT_KEY_FILE_NAME, assertPrivateKeyFilePermissions, keyFilePath };

/** @deprecated Use loadSigningKeyMaterial with a KeyProtector */
export type ReceiptKeyFile = ReceiptSigningKeyMaterial;

export function loadOrCreateReceiptKey(
  userDataDir: string,
  protector: KeyProtector,
): ReceiptSigningKeyMaterial {
  return loadSigningKeyMaterial(keyFilePath(userDataDir), protector);
}

export function exportPublicKeyDocument(material: ReceiptSigningKeyMaterial): {
  algorithm: 'Ed25519';
  publicKeySpki: string;
  fingerprint: string;
  createdAt: string;
  protectionLevel: ReceiptSigningKeyMaterial['protectionLevel'];
} {
  return {
    algorithm: 'Ed25519',
    publicKeySpki: material.publicKeySpki,
    fingerprint: publicKeyFingerprintFromSpki(material.publicKeySpki),
    createdAt: material.createdAt,
    protectionLevel: material.protectionLevel,
  };
}

export { readPublicKeySpkiFromFile };
