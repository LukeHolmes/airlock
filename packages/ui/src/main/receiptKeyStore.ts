import { safeStorage } from 'electron';
import {
  PLAINTEXT_KEY_WARNING,
  loadOrCreateReceiptKey,
  type KeyProtector,
  type ReceiptKeyProtectionLevel,
  type ReceiptSigningKeyMaterial,
} from '@airlock/core';

const ELECTRON_ENCRYPT_PREFIX = 'enc:v1:';

function buildElectronProtector(): KeyProtector {
  return {
    isEncryptionAvailable(): boolean {
      return safeStorage.isEncryptionAvailable();
    },
    encryptPrivateKeyPkcs8(pkcs8Base64: string): string {
      const encrypted = safeStorage.encryptString(pkcs8Base64);
      return `${ELECTRON_ENCRYPT_PREFIX}${encrypted.toString('base64')}`;
    },
    decryptPrivateKeyPkcs8(encryptedPayload: string): string {
      if (!encryptedPayload.startsWith(ELECTRON_ENCRYPT_PREFIX)) {
        throw new Error('Unknown encrypted key format');
      }
      const b64 = encryptedPayload.slice(ELECTRON_ENCRYPT_PREFIX.length);
      return safeStorage.decryptString(Buffer.from(b64, 'base64'));
    },
  };
}

export function getReceiptKeyProtector(): KeyProtector {
  return buildElectronProtector();
}

export type ReceiptKeyStatus = {
  protectionLevel: ReceiptKeyProtectionLevel;
  warning: string | null;
};

export function loadOrCreateElectronReceiptKey(userDataDir: string): {
  material: ReceiptSigningKeyMaterial;
  status: ReceiptKeyStatus;
} {
  const protector = getReceiptKeyProtector();
  const material = loadOrCreateReceiptKey(userDataDir, protector);
  return {
    material,
    status: {
      protectionLevel: material.protectionLevel,
      warning: material.protectionLevel === 'file-0600' ? PLAINTEXT_KEY_WARNING : null,
    },
  };
}
