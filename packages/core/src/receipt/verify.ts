import { publicKeyFingerprintFromSpki, verifyCanonicalPayload } from './crypto.js';
import { canonicalizeReceiptPayload } from './sign.js';
import {
  INSPECTION_RECEIPT_FORMAT,
  type InspectionReceiptPayload,
  type SignedInspectionReceipt,
  type VerifyReceiptResult,
} from './types.js';

function normalizeLegacyReceiptPayload(
  payload: InspectionReceiptPayload,
): InspectionReceiptPayload {
  const record = payload as InspectionReceiptPayload & {
    inspectionKind?: 'file' | 'url';
    signingKey?: { protectionLevel?: 'os-keychain' | 'file-0600' };
  };
  if (!record.inspectionKind && record.staticTriage) {
    return {
      ...record,
      inspectionKind: 'file',
      signingKey: {
        ...record.signingKey,
        protectionLevel: record.signingKey?.protectionLevel ?? 'file-0600',
      },
    };
  }
  if (record.signingKey && !record.signingKey.protectionLevel) {
    return {
      ...record,
      signingKey: {
        ...record.signingKey,
        protectionLevel: 'file-0600',
      },
    };
  }
  return record;
}

function isSignedReceipt(value: unknown): value is SignedInspectionReceipt {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.format === INSPECTION_RECEIPT_FORMAT &&
    typeof record.signature === 'string' &&
    typeof record.signingPublicKey === 'string' &&
    record.payload !== undefined &&
    typeof record.payload === 'object'
  );
}

export function verifySignedInspectionReceipt(
  receipt: SignedInspectionReceipt,
  options?: { publicKeySpkiBase64?: string },
): VerifyReceiptResult {
  if (!isSignedReceipt(receipt)) {
    return { ok: false, reason: 'Not a signed Airlock inspection receipt' };
  }

  const publicKey = options?.publicKeySpkiBase64 ?? receipt.signingPublicKey;
  const fingerprint = publicKeyFingerprintFromSpki(publicKey);
  const payload = normalizeLegacyReceiptPayload(receipt.payload);

  if (payload.signingKey?.publicKeyFingerprint !== fingerprint) {
    return { ok: false, reason: 'Public key fingerprint does not match signed payload metadata' };
  }

  const canonical = canonicalizeReceiptPayload(payload);
  const valid = verifyCanonicalPayload(canonical, receipt.signature, publicKey);
  if (!valid) {
    return { ok: false, reason: 'Signature verification failed (payload may have been altered)' };
  }

  return { ok: true, fingerprint, payload };
}

export function parseSignedReceiptJson(jsonText: string): SignedInspectionReceipt {
  const parsed = JSON.parse(jsonText) as unknown;
  if (!isSignedReceipt(parsed)) {
    throw new Error('Invalid signed inspection receipt JSON');
  }
  return parsed;
}

export function verifyReceiptJson(
  jsonText: string,
  options?: { publicKeySpkiBase64?: string },
): VerifyReceiptResult {
  try {
    const receipt = parseSignedReceiptJson(jsonText);
    return verifySignedInspectionReceipt(receipt, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: message };
  }
}
