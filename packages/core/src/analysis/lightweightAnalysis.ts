import type { SessionArtefacts } from '../session/artefacts.js';
import { debugLog } from '../session/debug.js';
import type { LightweightAnalysis } from './types.js';

const SHORT_SESSION_MS = 3000;

function sessionDurationMs(artefacts: SessionArtefacts): number {
  const { metadata, logs } = artefacts;
  const endTime = metadata.endTime ?? logs[logs.length - 1]?.ts ?? metadata.startTime;
  return Math.max(0, endTime - metadata.startTime);
}

function hasLogEvent(artefacts: SessionArtefacts, ...events: string[]): boolean {
  return artefacts.logs.some((log) => events.includes(log.event));
}

function hasFailure(artefacts: SessionArtefacts): boolean {
  return (
    hasLogEvent(artefacts, 'SESSION_ERROR') ||
    artefacts.metadata.exitReason === 'error' ||
    artefacts.metadata.exitReason === 'crash'
  );
}

function buildObservations(artefacts: SessionArtefacts): string[] {
  const observations: string[] = [];

  if (artefacts.input.type === 'file') {
    observations.push('File executed in isolated container');
  } else {
    observations.push('URL opened in sandboxed browser');
  }

  if (artefacts.metadata.networkMode === 'enabled') {
    observations.push('Network access was enabled');
  } else {
    observations.push('System was fully air-gapped');
  }

  observations.push(`Session generated ${artefacts.logs.length} system events`);

  return observations;
}

function buildSignals(artefacts: SessionArtefacts, shortExecution: boolean): string[] {
  const signals: string[] = [];

  if (hasLogEvent(artefacts, 'SESSION_CREATED', 'CONTAINER_STARTED')) {
    signals.push('Container successfully launched');
  }

  if (
    hasLogEvent(artefacts, 'SESSION_RUNNING', 'VNC_READY') ||
    artefacts.logs.some((log) => log.event === 'SESSION_RUNNING' && log.payload?.vncUrl)
  ) {
    signals.push('Remote desktop stream established');
  }

  if (shortExecution) {
    signals.push('Short execution — possible quick exit or failure');
  }

  if (artefacts.metadata.networkMode === 'enabled') {
    signals.push('External network interaction possible');
  }

  if (hasFailure(artefacts)) {
    signals.push('Unexpected failure detected during session');
  }

  return signals;
}

function deriveRiskLevel(
  artefacts: SessionArtefacts,
  shortExecution: boolean,
  failure: boolean,
): LightweightAnalysis['riskLevel'] {
  if (failure || (artefacts.metadata.networkMode === 'enabled' && shortExecution)) {
    return 'high';
  }

  if (artefacts.metadata.networkMode === 'enabled' || shortExecution) {
    return 'medium';
  }

  if (
    artefacts.input.type === 'file' &&
    artefacts.metadata.networkMode === 'isolated' &&
    !shortExecution
  ) {
    return 'low';
  }

  return 'medium';
}

function buildSummary(
  artefacts: SessionArtefacts,
  shortExecution: boolean,
  failure: boolean,
): string {
  const inputLabel = artefacts.input.type === 'file' ? 'file' : 'URL';
  const networkLabel =
    artefacts.metadata.networkMode === 'enabled'
      ? 'with network access enabled'
      : 'in a fully isolated environment';

  if (failure) {
    return `This ${inputLabel} session ran ${networkLabel} but encountered unexpected errors. Review the session signals before trusting this content.`;
  }

  if (shortExecution) {
    return `This ${inputLabel} was processed ${networkLabel}. The session ended quickly, which may indicate a rapid exit or incomplete execution.`;
  }

  if (artefacts.metadata.networkMode === 'enabled') {
    return `This ${inputLabel} was opened ${networkLabel}. External network interaction was possible during the session. No unexpected failures were detected.`;
  }

  return `This ${inputLabel} was executed ${networkLabel}. No external network access was permitted. The session completed normally with no unexpected behaviour.`;
}

function buildRecommendation(riskLevel: LightweightAnalysis['riskLevel']): string {
  switch (riskLevel) {
    case 'low':
      return 'File appears safe under current observation. Proceed with caution.';
    case 'medium':
      return 'Behaviour is inconclusive. Further analysis recommended.';
    case 'high':
      return 'Potentially unsafe behaviour detected. Do not trust this file.';
  }
}

export function generateLightweightAnalysis(artefacts: SessionArtefacts): LightweightAnalysis {
  debugLog('generateLightweightAnalysis start', {
    sessionId: artefacts.sessionId,
    eventCount: artefacts.logs.length,
  });

  const shortExecution = sessionDurationMs(artefacts) < SHORT_SESSION_MS;
  const failure = hasFailure(artefacts);
  const riskLevel = deriveRiskLevel(artefacts, shortExecution, failure);

  const analysis: LightweightAnalysis = {
    summary: buildSummary(artefacts, shortExecution, failure),
    riskLevel,
    observations: buildObservations(artefacts),
    signals: buildSignals(artefacts, shortExecution),
    recommendation: buildRecommendation(riskLevel),
  };

  debugLog('generateLightweightAnalysis complete', {
    sessionId: artefacts.sessionId,
    riskLevel: analysis.riskLevel,
  });

  return analysis;
}
