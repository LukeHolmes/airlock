import type { StaticTriageReport, TriageRiskLevel } from '../triage/types.js';
import type { TriageUrlFinding } from '../triage/types.js';
import { publicKeyFingerprintFromSpki } from './crypto.js';
import type { ReceiptKeyProtectionLevel } from './keyProtector.js';
import {
  NO_FILE_STATIC_TRIAGE,
  RECEIPT_AI_SUMMARY_NOTICE,
  type InspectionReceiptPayload,
  type InspectionReceiptSandboxImage,
  type InspectionToolchain,
  type UrlSessionInspection,
} from './types.js';

export type BuildFileInspectionReceiptInput = {
  kind: 'file';
  appVersion: string;
  sandboxImage: InspectionReceiptSandboxImage;
  inspectionToolchain: InspectionToolchain;
  staticTriage: StaticTriageReport;
  sessionId: string;
  startedAtMs: number;
  endedAtMs: number;
  signingPublicKeySpki: string;
  keyProtectionLevel: ReceiptKeyProtectionLevel;
};

export type BuildUrlInspectionReceiptInput = {
  kind: 'url';
  appVersion: string;
  sandboxImage: InspectionReceiptSandboxImage;
  urlAsEntered: string;
  offlineUrlXray: TriageUrlFinding[];
  riskLevel: TriageRiskLevel;
  sessionId: string;
  startedAtMs: number;
  endedAtMs: number;
  signingPublicKeySpki: string;
  keyProtectionLevel: ReceiptKeyProtectionLevel;
};

export type BuildInspectionReceiptInput =
  BuildFileInspectionReceiptInput | BuildUrlInspectionReceiptInput;

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
  const base = {
    schemaVersion: 2 as const,
    appVersion: input.appVersion,
    sandboxImage: input.sandboxImage,
    session: {
      sessionId: input.sessionId,
      startedAt: toUtcIso(input.startedAtMs),
      endedAt: toUtcIso(input.endedAtMs),
    },
    signingKey: {
      publicKeyFingerprint: fingerprint,
      protectionLevel: input.keyProtectionLevel,
    },
    reserved: {
      aiSummaryExcluded: true as const,
      note: RECEIPT_AI_SUMMARY_NOTICE as InspectionReceiptPayload['reserved']['note'],
    },
  };

  if (input.kind === 'file') {
    return {
      ...base,
      inspectionKind: 'file',
      inspectionToolchain: input.inspectionToolchain,
      input: input.staticTriage.input,
      staticTriage: input.staticTriage,
      riskLevel: input.staticTriage.riskLevel,
    };
  }

  const urlInspection: UrlSessionInspection = {
    urlAsEntered: input.urlAsEntered,
    offlineUrlXray: input.offlineUrlXray,
    noFileStaticTriage: NO_FILE_STATIC_TRIAGE,
  };

  return {
    ...base,
    inspectionKind: 'url',
    inspectionToolchain: {
      yaraRulesSha256: NO_FILE_STATIC_TRIAGE,
      tools: {},
    },
    urlInspection,
    riskLevel: input.riskLevel,
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
