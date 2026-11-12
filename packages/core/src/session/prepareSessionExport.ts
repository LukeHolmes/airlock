import { analyzeSession } from './analyzeSession.js';
import { getSessionArtefacts } from './artefacts.js';
import {
  extractContainerIdFromLogs,
  formatSessionExportJson,
  serializeSessionExport,
  type SessionExportDocument,
} from './sessionExport.js';
import { getTriageSessionState } from '../triage/triageStore.js';
import { resolveSessionInputFingerprint } from './sessionExportFingerprint.js';

export type PreparedSessionExport = {
  document: SessionExportDocument;
  json: string;
  suggestedFileName: string;
};

export async function prepareSessionExport(
  sessionId: string,
  appVersion: string,
  exportedAt = new Date().toISOString(),
): Promise<PreparedSessionExport> {
  const { analysis } = await analyzeSession(sessionId);
  const artefacts = getSessionArtefacts(sessionId);
  const containerId = extractContainerIdFromLogs(artefacts.logs);
  const inputFingerprint = await resolveSessionInputFingerprint(artefacts);
  const triageState = getTriageSessionState(sessionId);
  const staticTriage = triageState?.status === 'complete' ? triageState.report : undefined;

  const document = serializeSessionExport({
    exportedAt,
    appVersion,
    sessionId,
    containerId,
    artefacts,
    analysis,
    inputFingerprint,
    staticTriage,
  });

  const shortId = sessionId.replace(/-/g, '').slice(0, 12);

  return {
    document,
    json: formatSessionExportJson(document),
    suggestedFileName: `airlock-session-${shortId}.json`,
  };
}
