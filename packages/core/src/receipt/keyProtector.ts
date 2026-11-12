export type ReceiptKeyProtectionLevel = 'os-keychain' | 'file-0600';

export type KeyProtector = {
  isEncryptionAvailable(): boolean;
  encryptPrivateKeyPkcs8(pkcs8Base64: string): string;
  decryptPrivateKeyPkcs8(encryptedPayload: string): string;
};

export const PLAINTEXT_KEY_WARNING =
  'OS secret storage is unavailable; the receipt signing key is stored on disk with mode 600 only. Prefer a system with Keychain / DPAPI / Secret Service enabled.';
