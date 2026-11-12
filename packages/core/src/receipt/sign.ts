import { canonicalizeJson } from './jcs.js';
import { signCanonicalPayload } from './crypto.js';
import {
  INSPECTION_RECEIPT_FORMAT,
  INSPECTION_RECEIPT_SCHEMA_VERSION,
  RECEIPT_INTEGRITY_NOTICE,
  type InspectionReceiptPayload,
  type SignedInspectionReceipt,
} from './types.js';

export function canonicalizeReceiptPayload(payload: InspectionReceiptPayload): string {
  return canonicalizeJson(payload);
}

export function signInspectionReceipt(
  payload: InspectionReceiptPayload,
  privateKeyPkcs8Base64: string,
  publicKeySpkiBase64: string,
): SignedInspectionReceipt {
  const canonical = canonicalizeReceiptPayload(payload);
  const signature = signCanonicalPayload(canonical, privateKeyPkcs8Base64);
  return {
    format: INSPECTION_RECEIPT_FORMAT,
    formatVersion: INSPECTION_RECEIPT_SCHEMA_VERSION,
    integrityNotice: RECEIPT_INTEGRITY_NOTICE,
    payload,
    signature,
    signingPublicKey: publicKeySpkiBase64,
  };
}

export function formatSignedReceiptJson(receipt: SignedInspectionReceipt, pretty = true): string {
  return pretty ? `${JSON.stringify(receipt, null, 2)}\n` : JSON.stringify(receipt);
}
