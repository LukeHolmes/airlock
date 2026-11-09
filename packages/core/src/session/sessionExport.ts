import type { LightweightAnalysis } from '../analysis/types.js';
import type { SessionArtefacts } from './artefacts.js';
import type { AirlockSession } from './types.js';

/** Document schema version for `docs/session-export.schema.json`. */
export const SESSION_EXPORT_SCHEMA_VERSION = 1;

export type SessionExportFileFingerprint = {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  extension: string;
  sha256: string;
};

export type SessionExportUrlFingerprint = {
  url: string;
};

export type SessionExportSerializerInput = {
  exportedAt: string;
  appVersion: string;
  sessionId: string;
  containerId?: string;
  artefacts: SessionArtefacts;
  analysis: LightweightAnalysis;
  inputFingerprint?: SessionExportFileFingerprint | SessionExportUrlFingerprint;
};

export type SessionExportDocument = {
  schemaVersion: typeof SESSION_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  appVersion: string;
  session: {
    sessionId: string;
    containerId?: string;
    metadata: AirlockSession['metadata'];
    input: SessionArtefacts['input'];
    inputFingerprint?: SessionExportFileFingerprint | SessionExportUrlFingerprint;
  };
  artefacts: {
    logs: SessionArtefacts['logs'];
  };
  analysis: LightweightAnalysis;
};

export function extractContainerIdFromLogs(logs: SessionArtefacts['logs']): string | undefined {
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    const payload = logs[i].payload;
    const containerId = payload?.containerId;
    if (typeof containerId === 'string' && containerId.length > 0) {
      return containerId;
    }
  }
  return undefined;
}

/**
 * Pure JSON document builder for opt-in session export. Does not read the filesystem or network.
 */
export function serializeSessionExport(input: SessionExportSerializerInput): SessionExportDocument {
  return {
    schemaVersion: SESSION_EXPORT_SCHEMA_VERSION,
    exportedAt: input.exportedAt,
    appVersion: input.appVersion,
    session: {
      sessionId: input.sessionId,
      ...(input.containerId ? { containerId: input.containerId } : {}),
      metadata: input.artefacts.metadata,
      input: input.artefacts.input,
      ...(input.inputFingerprint ? { inputFingerprint: input.inputFingerprint } : {}),
    },
    artefacts: {
      logs: input.artefacts.logs,
    },
    analysis: input.analysis,
  };
}

export function formatSessionExportJson(document: SessionExportDocument, pretty = true): string {
  return pretty ? `${JSON.stringify(document, null, 2)}\n` : JSON.stringify(document);
}
