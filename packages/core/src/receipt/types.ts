import type { StaticTriageReport, TriageRiskLevel, TriageUrlFinding } from '../triage/types.js';
import type { ReceiptKeyProtectionLevel } from './keyProtector.js';

/** Signed inspection receipt payload schema (authoritative JSON). */
export const INSPECTION_RECEIPT_SCHEMA_VERSION = 2;

export const INSPECTION_RECEIPT_FORMAT = 'airlock-inspection-receipt';

export const NO_FILE_STATIC_TRIAGE = 'no_file_static_triage_performed';

export const RECEIPT_INTEGRITY_NOTICE =
  'This receipt proves the signed payload has not been altered since it was signed by this Airlock installation. It does not prove identity of the signer to third parties unless you distribute the public key, and it does not mean the inspected file is benign.';

export const RECEIPT_AI_SUMMARY_NOTICE =
  'AI-generated summaries (when offered in a future release) are excluded from the signed payload.';

export type InspectionToolchain = {
  yaraRulesSha256: string;
  tools: Record<string, string>;
};

export type InspectionReceiptSandboxImage = {
  ref: string;
  digest: string;
};

export type InspectionReceiptSessionTimes = {
  sessionId: string;
  startedAt: string;
  endedAt: string;
};

export type InspectionReceiptReserved = {
  aiSummaryExcluded: true;
  note: typeof RECEIPT_AI_SUMMARY_NOTICE;
};

export type UrlSessionInspection = {
  urlAsEntered: string;
  offlineUrlXray: TriageUrlFinding[];
  noFileStaticTriage: 'no_file_static_triage_performed';
};

/** Payload covered by the Ed25519 signature (JCS-serialized). */
export type InspectionReceiptPayload = {
  schemaVersion: 2;
  appVersion: string;
  inspectionKind: 'file' | 'url';
  sandboxImage: InspectionReceiptSandboxImage;
  inspectionToolchain: InspectionToolchain;
  /** Present when `inspectionKind` is `file`. */
  input?: StaticTriageReport['input'];
  staticTriage?: StaticTriageReport;
  urlInspection?: UrlSessionInspection;
  riskLevel: TriageRiskLevel;
  session: InspectionReceiptSessionTimes;
  signingKey: {
    publicKeyFingerprint: string;
    protectionLevel: ReceiptKeyProtectionLevel;
  };
  reserved: InspectionReceiptReserved;
};

export type SignedInspectionReceipt = {
  format: typeof INSPECTION_RECEIPT_FORMAT;
  formatVersion: 2;
  integrityNotice: typeof RECEIPT_INTEGRITY_NOTICE;
  payload: InspectionReceiptPayload;
  /** Base64 Ed25519 signature over UTF-8 JCS bytes of `payload`. */
  signature: string;
  /** Base64 SPKI DER — included so verify works without the host key file. */
  signingPublicKey: string;
};

export type VerifyReceiptResult =
  | { ok: true; fingerprint: string; payload: InspectionReceiptPayload }
  | { ok: false; reason: string };
