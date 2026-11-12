import { getSessionArtefacts } from '../session/artefacts.js';
import { getTriageSessionState } from '../triage/triageStore.js';
import { deriveUrlOnlyRiskLevel, xrayUrlAsEntered } from '../triage/urlXray.js';
import {
  buildInspectionReceiptPayload,
  defaultInspectionToolchain,
  toolchainFromTriageReport,
} from './buildPayload.js';
import type { ReceiptKeyProtectionLevel } from './keyProtector.js';
import { signInspectionReceipt, formatSignedReceiptJson } from './sign.js';
import type { InspectionReceiptSandboxImage } from './types.js';
import type { SignedInspectionReceipt } from './types.js';

export type PreparedInspectionReceipt = {
  receipt: SignedInspectionReceipt;
  json: string;
  suggestedBaseName: string;
};

export function extractSandboxImageFromLogs(
  logs: Array<{ payload?: Record<string, unknown> }>,
): InspectionReceiptSandboxImage | undefined {
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    const payload = logs[i].payload;
    if (!payload) {
      continue;
    }
    const ref = payload.sandboxImageRef;
    const digest = payload.sandboxImageDigest;
    if (typeof ref === 'string' && typeof digest === 'string' && ref && digest) {
      return { ref, digest };
    }
  }
  return undefined;
}

export type PrepareInspectionReceiptOptions = {
  appVersion: string;
  privateKeyPkcs8: string;
  publicKeySpki: string;
  keyProtectionLevel: ReceiptKeyProtectionLevel;
  exportedAtMs?: number;
};

export async function prepareInspectionReceipt(
  sessionId: string,
  options: PrepareInspectionReceiptOptions,
): Promise<PreparedInspectionReceipt> {
  const artefacts = getSessionArtefacts(sessionId);
  const sandboxImage =
    extractSandboxImageFromLogs(artefacts.logs) ??
    ({
      ref: 'airlock/sandbox:latest',
      digest: 'unknown',
    } satisfies InspectionReceiptSandboxImage);

  const fallbackEnd = options.exportedAtMs ?? Date.now();
  const startedAtMs = artefacts.metadata.startTime > 0 ? artefacts.metadata.startTime : fallbackEnd;
  const endedAtMs = artefacts.metadata.endTime ?? fallbackEnd;

  let receipt: SignedInspectionReceipt;

  if (artefacts.input.type === 'url') {
    const urlAsEntered = artefacts.input.value;
    const offlineUrlXray = xrayUrlAsEntered(urlAsEntered);
    const payload = buildInspectionReceiptPayload({
      kind: 'url',
      appVersion: options.appVersion,
      sandboxImage,
      urlAsEntered,
      offlineUrlXray,
      riskLevel: deriveUrlOnlyRiskLevel(offlineUrlXray),
      sessionId,
      startedAtMs,
      endedAtMs,
      signingPublicKeySpki: options.publicKeySpki,
      keyProtectionLevel: options.keyProtectionLevel,
    });
    receipt = signInspectionReceipt(payload, options.privateKeyPkcs8, options.publicKeySpki);
  } else {
    const triageState = getTriageSessionState(sessionId);
    if (triageState?.status !== 'complete') {
      throw new Error('Static triage must complete before exporting a signed file receipt');
    }
    const staticTriage = triageState.report;
    const toolchain = toolchainFromTriageReport(staticTriage) ?? defaultInspectionToolchain();
    const payload = buildInspectionReceiptPayload({
      kind: 'file',
      appVersion: options.appVersion,
      sandboxImage,
      inspectionToolchain: toolchain,
      staticTriage,
      sessionId,
      startedAtMs,
      endedAtMs,
      signingPublicKeySpki: options.publicKeySpki,
      keyProtectionLevel: options.keyProtectionLevel,
    });
    receipt = signInspectionReceipt(payload, options.privateKeyPkcs8, options.publicKeySpki);
  }

  const shortId = sessionId.replace(/-/g, '').slice(0, 12);

  return {
    receipt,
    json: formatSignedReceiptJson(receipt),
    suggestedBaseName: `airlock-receipt-${shortId}`,
  };
}
