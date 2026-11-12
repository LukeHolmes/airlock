import type { StaticTriageReport } from '../triage/types.js';
import { publicKeyFingerprintFromSpki } from './crypto.js';
import {
  INSPECTION_RECEIPT_SCHEMA_VERSION,
  RECEIPT_AI_SUMMARY_NOTICE,
  type InspectionReceiptPayload,
  type InspectionReceiptSandboxImage,
  type InspectionToolchain,
} from './types.js';

export type BuildInspectionReceiptInput = {
  appVersion: string;
  sandboxImage: InspectionReceiptSandboxImage;
  inspectionToolchain: InspectionToolchain;
  staticTriage: StaticTriageReport;
  sessionId: string;
  startedAtMs: number;
  endedAtMs: number;
  signingPublicKeySpki: string;
};

function toUtcIso(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return new Date(0).toISOString();
  }
  return new Date(ms).toISOString();
}

export function buildInspectionReceiptPayload(
  input: BuildInspectionReceiptInput,
): InspectionReceiptPayload {
  const fingerprint = publicKeyFingerprintFromSpki(input.signingPublicKeySpki);
  return {
    schemaVersion: INSPECTION_RECEIPT_SCHEMA_VERSION,
    appVersion: input.appVersion,
    sandboxImage: input.sandboxImage,
    inspectionToolchain: input.inspectionToolchain,
    input: input.staticTriage.input,
    staticTriage: input.staticTriage,
    riskLevel: input.staticTriage.riskLevel,
    session: {
      sessionId: input.sessionId,
      startedAt: toUtcIso(input.startedAtMs),
      endedAt: toUtcIso(input.endedAtMs),
    },
    signingKey: {
      publicKeyFingerprint: fingerprint,
    },
    reserved: {
      aiSummaryExcluded: true,
      note: RECEIPT_AI_SUMMARY_NOTICE,
    },
  };
}

export function defaultInspectionToolchain(): InspectionToolchain {
  return {
    yaraRulesSha256: 'unknown',
    tools: {},
  };
}

export function toolchainFromTriageReport(
  report: StaticTriageReport,
): InspectionToolchain | undefined {
  const chain = report.inspectionToolchain;
  if (!chain) {
    return undefined;
  }
  return {
    yaraRulesSha256: chain.yaraRulesSha256,
    tools: { ...chain.tools },
  };
}
